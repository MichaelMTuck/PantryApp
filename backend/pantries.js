const express = require('express');
const { randomBytes, createHash } = require('node:crypto');
const pool = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();

// All routes in this file require login.
router.use(requireAuth);

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function transaction(work) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Check membership before accessing a specific pantry.
async function requireMember(req, res, next) {
  const pantryId = Number(req.params.pantryId);

  if (!Number.isSafeInteger(pantryId) || pantryId <= 0) {
    fail(400, 'Invalid pantry ID.');
  }

  const result = await pool.query(
    `SELECT role
     FROM pantry_app.pantry_members
     WHERE pantry_id = $1 AND user_id = $2`,
    [pantryId, req.user.id]
  );

  if (!result.rowCount) {
    fail(403, 'You are not a member of this pantry.');
  }

  req.pantryId = pantryId;
  req.pantryRole = result.rows[0].role;
  next();
}

// List the logged-in user's pantries.
router.get('/pantries', async (req, res) => {
  const result = await pool.query(
    `SELECT p.id, p.name, m.role
     FROM pantry_app.pantries p
     JOIN pantry_app.pantry_members m ON m.pantry_id = p.id
     WHERE m.user_id = $1
     ORDER BY p.id`,
    [req.user.id]
  );

  res.json(result.rows);
});

// Create a pantry and its owner membership together.
router.post('/pantries', async (req, res) => {
  const name = req.body?.name;

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.trim().length > 100
  ) {
    fail(400, 'Pantry name must contain 1–100 characters.');
  }

  const pantry = await transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO pantry_app.pantries (name)
       VALUES ($1)
       RETURNING id, name`,
      [name.trim()]
    );

    const created = result.rows[0];

    await client.query(
      `INSERT INTO pantry_app.pantry_members
         (pantry_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [created.id, req.user.id]
    );

    return { ...created, role: 'owner' };
  });

  res.status(201).json(pantry);
});

// List pantry members.
router.get('/pantries/:pantryId/members', requireMember, async (req, res) => {
  const result = await pool.query(
    `SELECT u.id, u.display_name, m.role
     FROM pantry_app.pantry_members m
     JOIN pantry_app.users u ON u.id = m.user_id
     WHERE m.pantry_id = $1
     ORDER BY u.id`,
    [req.pantryId]
  );

  res.json(result.rows);
});

// Owner creates an invitation.
// Only the token hash is stored in PostgreSQL.
router.post('/pantries/:pantryId/invites', requireMember, async (req, res) => {
  if (req.pantryRole !== 'owner') {
    fail(403, 'Only the owner can create invitations.');
  }

  const code = randomBytes(32).toString('hex');

  const result = await pool.query(
    `INSERT INTO pantry_app.pantry_invites
       (token_hash, pantry_id, created_by, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')
     RETURNING expires_at`,
    [hashToken(code), req.pantryId, req.user.id]
  );

  res.status(201).json({
    code,
    expires_at: result.rows[0].expires_at,
  });
});

// Logged-in user accepts a single-use invitation.
router.post('/invites/accept', async (req, res) => {
  const code = req.body?.code;

  if (typeof code !== 'string' || !/^[a-f0-9]{64}$/.test(code)) {
    fail(400, 'Invalid invitation code.');
  }

  const pantry = await transaction(async (client) => {
    const result = await client.query(
      `SELECT pantry_id
       FROM pantry_app.pantry_invites
       WHERE token_hash = $1 AND expires_at > NOW()
       FOR UPDATE`,
      [hashToken(code)]
    );

    if (!result.rowCount) {
      fail(400, 'Invitation is invalid, expired, or already used.');
    }

    const pantryId = result.rows[0].pantry_id;

    const membership = await client.query(
      `SELECT 1 FROM pantry_app.pantry_members
       WHERE pantry_id = $1 AND user_id = $2`,
      [pantryId, req.user.id]
    );

    if (membership.rowCount) {
      fail(409, 'You already belong to this pantry.');
    }

    await client.query(
      `INSERT INTO pantry_app.pantry_members
         (pantry_id, user_id, role)
       VALUES ($1, $2, 'member')`,
      [pantryId, req.user.id]
    );

    await client.query(
      `DELETE FROM pantry_app.pantry_invites
       WHERE token_hash = $1`,
      [hashToken(code)]
    );

    const details = await client.query(
      `SELECT id, name FROM pantry_app.pantries WHERE id = $1`,
      [pantryId]
    );

    return { ...details.rows[0], role: 'member' };
  });

  res.json(pantry);
});

// ---------- PANTRY ITEMS ----------

// Validate optional dates without allowing impossible calendar dates.
function optionalDate(value, label) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    fail(400, `${label} must use YYYY-MM-DD.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    fail(400, `${label} must be a real date.`);
  }

  return value;
}

function validateItem(body) {
  const {
    name,
    quantity,
    unit,
    expiration_date,
    purchased_on,
    total_cost,
  } = body ?? {};

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.trim().length > 150
  ) {
    fail(400, 'Name must contain 1–150 characters.');
  }

  if (
    typeof quantity !== 'number' ||
    !Number.isFinite(quantity) ||
    quantity < 0 ||
    quantity > 1000000000
  ) {
    fail(400, 'Quantity must be a number between 0 and 1000000000.');
  }

  if (
    typeof unit !== 'string' ||
    !unit.trim() ||
    unit.trim().length > 30
  ) {
    fail(400, 'Unit must contain 1–30 characters.');
  }

  const cost = total_cost === undefined || total_cost === null
    ? null
    : total_cost;

  if (
    cost !== null &&
    (
      typeof cost !== 'number' ||
      !Number.isFinite(cost) ||
      cost < 0 ||
      cost > 1000000000
    )
  ) {
    fail(400, 'Total cost must be a nonnegative number.');
  }

  return {
    name: name.trim(),
    quantity,
    unit: unit.trim(),
    expirationDate: optionalDate(expiration_date, 'Expiration date'),
    purchasedOn: optionalDate(purchased_on, 'Purchase date'),
    totalCost: cost,
  };
}

function itemIdFromRequest(req) {
  const id = Number(req.params.itemId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    fail(400, 'Invalid item ID.');
  }

  return id;
}

// Reuse an existing ingredient by name when possible.
// Renaming a pantry item selects another ingredient rather than
// renaming the shared catalog entry used by other households.
async function findOrCreateIngredient(client, name) {
  const existing = await client.query(
    `SELECT id
     FROM pantry_app.ingredients
     WHERE lower(name) = lower($1)
     ORDER BY id
     LIMIT 1`,
    [name]
  );

  if (existing.rowCount) {
    return existing.rows[0].id;
  }

  const created = await client.query(
    `INSERT INTO pantry_app.ingredients (name)
     VALUES ($1)
     RETURNING id`,
    [name]
  );

  return created.rows[0].id;
}

// Date is also returned as "date" for your current PantryItem component.
const itemSelect = `
  SELECT
    pi.id,
    pi.pantry_id,
    pi.ingredient_id,
    i.name,
    pi.quantity::float8 AS quantity,
    pi.unit,
    to_char(pi.expiration_date, 'YYYY-MM-DD') AS expiration_date,
    to_char(pi.expiration_date, 'YYYY-MM-DD') AS date,
    to_char(pi.purchased_on, 'YYYY-MM-DD') AS purchased_on,
    pi.total_cost,
    pi.created_at
  FROM pantry_app.pantry_items pi
  JOIN pantry_app.ingredients i ON i.id = pi.ingredient_id
`;

// List stock in this pantry.
router.get(
  '/pantries/:pantryId/items',
  requireMember,
  async (req, res) => {
    const result = await pool.query(
      `${itemSelect}
       WHERE pi.pantry_id = $1
       ORDER BY pi.created_at DESC, pi.id DESC`,
      [req.pantryId]
    );

    res.json(result.rows);
  }
);

// Add a stock entry.
router.post(
  '/pantries/:pantryId/items',
  requireMember,
  async (req, res) => {
    const item = validateItem(req.body);

    const saved = await transaction(async (client) => {
      const ingredientId = await findOrCreateIngredient(
        client,
        item.name
      );

      const inserted = await client.query(
        `INSERT INTO pantry_app.pantry_items
           (
             pantry_id,
             ingredient_id,
             quantity,
             unit,
             expiration_date,
             purchased_on,
             total_cost
           )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          req.pantryId,
          ingredientId,
          item.quantity,
          item.unit,
          item.expirationDate,
          item.purchasedOn,
          item.totalCost,
        ]
      );

      const result = await client.query(
        `${itemSelect}
         WHERE pi.id = $1 AND pi.pantry_id = $2`,
        [inserted.rows[0].id, req.pantryId]
      );

      return result.rows[0];
    });

    res.status(201).json(saved);
  }
);

// Replace an item's editable fields.
// The request must include name, quantity, and unit.
// Omitted optional fields are cleared.
router.put(
  '/pantries/:pantryId/items/:itemId',
  requireMember,
  async (req, res) => {
    const itemId = itemIdFromRequest(req);
    const item = validateItem(req.body);

    const saved = await transaction(async (client) => {
      const existing = await client.query(
        `SELECT id
         FROM pantry_app.pantry_items
         WHERE id = $1 AND pantry_id = $2
         FOR UPDATE`,
        [itemId, req.pantryId]
      );

      if (!existing.rowCount) {
        fail(404, 'Pantry item not found.');
      }

      const ingredientId = await findOrCreateIngredient(
        client,
        item.name
      );

      await client.query(
        `UPDATE pantry_app.pantry_items
         SET
           ingredient_id = $3,
           quantity = $4,
           unit = $5,
           expiration_date = $6,
           purchased_on = $7,
           total_cost = $8
         WHERE id = $1 AND pantry_id = $2`,
        [
          itemId,
          req.pantryId,
          ingredientId,
          item.quantity,
          item.unit,
          item.expirationDate,
          item.purchasedOn,
          item.totalCost,
        ]
      );

      const result = await client.query(
        `${itemSelect}
         WHERE pi.id = $1 AND pi.pantry_id = $2`,
        [itemId, req.pantryId]
      );

      return result.rows[0];
    });

    res.json(saved);
  }
);

// Delete this pantry's stock entry, keeping the ingredient catalog.
router.delete(
  '/pantries/:pantryId/items/:itemId',
  requireMember,
  async (req, res) => {
    const itemId = itemIdFromRequest(req);

    const result = await pool.query(
      `DELETE FROM pantry_app.pantry_items
       WHERE id = $1 AND pantry_id = $2`,
      [itemId, req.pantryId]
    );

    if (!result.rowCount) {
      fail(404, 'Pantry item not found.');
    }

    res.sendStatus(204);
  }
);

// Load recipes belonging to a pantry.
// Correlated subqueries keep ingredients and steps from duplicating
// one another when a recipe has several of each.
const recipeSelect = `
  SELECT
    r.id,
    r.name,
    r.description,
    r.servings::float8 AS servings,
    (r.prep_minutes + r.cook_minutes)::text || ' min' AS time,
    COALESCE(
      (
        SELECT json_agg(
          ri.quantity::float8::text || ' ' || ri.unit || ' ' || i.name
          ORDER BY ri.position
        )
        FROM pantry_app.recipe_ingredients ri
        JOIN pantry_app.ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = r.id
      ),
      '[]'::json
    ) AS ingredients,
    COALESCE(
      (
        SELECT json_agg(rs.instruction ORDER BY rs.step_number)
        FROM pantry_app.recipe_steps rs
        WHERE rs.recipe_id = r.id
      ),
      '[]'::json
    ) AS steps
  FROM pantry_app.recipes r
`;

// List the selected pantry's recipes.
router.get(
  '/pantries/:pantryId/recipes',
  requireMember,
  async (req, res) => {
    const result = await pool.query(
      `${recipeSelect}
       WHERE r.pantry_id = $1
       ORDER BY lower(r.name), r.id`,
      [req.pantryId]
    );

    res.json(result.rows);
  }
);

// Load one recipe without allowing access to another pantry's recipe.
router.get(
  '/pantries/:pantryId/recipes/:recipeId',
  requireMember,
  async (req, res) => {
    const recipeId = Number(req.params.recipeId);

    if (!Number.isSafeInteger(recipeId) || recipeId <= 0) {
      fail(400, 'Invalid recipe ID.');
    }

    const result = await pool.query(
      `${recipeSelect}
       WHERE r.pantry_id = $1 AND r.id = $2`,
      [req.pantryId, recipeId]
    );

    if (!result.rowCount) {
      fail(404, 'Recipe not found.');
    }

    res.json(result.rows[0]);
  }
);

// Method for cooking a recipe and deducting its ingredients from the pantry.
router.post(
  '/pantries/:pantryId/recipes/:recipeId/cook',
  requireMember,
  async (req, res, next) => {
    const pantryId = req.pantryId;
    const recipeId = Number(req.params.recipeId);
    const client = await pool.connect();

    try {
      if (!Number.isSafeInteger(recipeId) || recipeId <= 0) {
        fail(400, 'Invalid recipe ID.');
      }

      await client.query('BEGIN');

      // Double check that the recipe belongs to the pantry in question
      const recipeResult = await client.query(
        `SELECT id
         FROM pantry_app.recipes
         WHERE id = $1 AND pantry_id = $2`,
        [recipeId, pantryId]
      );

      if (!recipeResult.rowCount) {
        fail(404, 'Recipe not found.');
      }

      // Read the all the quantities required by this recipe from the database.
      const requiredResult = await client.query(
        `SELECT ingredient_id, quantity, unit
         FROM pantry_app.recipe_ingredients
         WHERE recipe_id = $1
         ORDER BY position`,
        [recipeId]
      );

      if (!requiredResult.rowCount) {
        fail(400, 'This recipe has no ingredients.');
      }

      // Lock the matching pantry stock rows while checking quantities to prevent race conditions.
      const ingredientIds = requiredResult.rows.map(
        (ingredient) => ingredient.ingredient_id
      );

      const stockResult = await client.query(
        `SELECT id, ingredient_id, quantity, unit
         FROM pantry_app.pantry_items
         WHERE pantry_id = $1
           AND ingredient_id = ANY($2::int[])
         FOR UPDATE`,
        [pantryId, ingredientIds]
      );

      const stockByIngredient = new Map(
        stockResult.rows.map((item) => [
          Number(item.ingredient_id),
          item,
        ])
      );

      const problems = [];

      for (const required of requiredResult.rows) {
        const stock = stockByIngredient.get(
          Number(required.ingredient_id)
        );

        if (!stock) {
          problems.push(`Missing ingredient ID ${required.ingredient_id}`);
          continue;
        }

        if (
          stock.unit.trim().toLowerCase() !==
          required.unit.trim().toLowerCase()
        ) {
          problems.push(
            `Ingredient ID ${required.ingredient_id} uses ${stock.unit} ` +
            `in the pantry but ${required.unit} in the recipe`
          );
          continue;
        }

        if (Number(stock.quantity) < Number(required.quantity)) {
          problems.push(
            `Not enough of ingredient ID ${required.ingredient_id}: ` +
            `${stock.quantity} ${stock.unit} available; ` +
            `${required.quantity} ${required.unit} required`
          );
        }
      }

      if (problems.length > 0) {
        const error = new Error(problems.join('; '));
        error.status = 409;
        throw error;
      }

      // Deduct if it passes all validation checks.
      for (const required of requiredResult.rows) {
        await client.query(
          `UPDATE pantry_app.pantry_items
           SET quantity = quantity - $1
           WHERE pantry_id = $2
             AND ingredient_id = $3`,
          [required.quantity, pantryId, required.ingredient_id]
        );
      }

      await client.query('COMMIT');

      res.json({
        cooked: true,
        message: 'Recipe cooked. Pantry quantities were updated.',
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      next(error);
    } finally {
      client.release();
    }
  }
);

module.exports = router;
