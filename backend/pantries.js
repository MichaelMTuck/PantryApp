const express = require('express');
const { randomBytes, createHash } = require('node:crypto');
const pool = require('./db');
const { requireAuth } = require('./auth');
const { validateRecipe } = require('./recipeInput');

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
             total_cost,
             cost_basis_quantity
           )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           CASE WHEN $7::numeric IS NOT NULL AND $3::numeric >= 0.0001
                THEN $3::numeric ELSE NULL END
         )
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
           total_cost = $8,
           cost_basis_quantity = CASE
             WHEN $8::numeric IS NULL THEN NULL
             WHEN cost_basis_quantity IS NOT NULL
                  AND total_cost = $8::numeric
                  AND ingredient_id = $3
                  AND unit = $5
               THEN cost_basis_quantity
             WHEN $4::numeric >= 0.0001 THEN $4::numeric
             ELSE NULL
           END
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


router.patch(
  '/pantries/:pantryId/items/:itemId/quantity',
  requireMember,
  async (req, res) => {
    const itemId = itemIdFromRequest(req);
    const change = req.body?.change;

    if (
      typeof change !== 'number' ||
      !Number.isFinite(change) ||
      Math.abs(change) > 1000000000
    ) {
      fail(400, 'Enter a valid quantity change.');
    }

    const delta = Math.round(change * 10000) / 10000;
    if (delta === 0) fail(400, 'Quantity change is too small.');

    const item = await transaction(async (client) => {
      const updated = await client.query(
        `UPDATE pantry_app.pantry_items
         SET quantity = GREATEST(0, quantity + $3::numeric)
         WHERE pantry_id = $1 AND id = $2
           AND quantity + $3::numeric <= 1000000000
         RETURNING id`,
        [req.pantryId, itemId, delta]
      );

      if (!updated.rowCount) {
        const existing = await client.query(
          `SELECT id FROM pantry_app.pantry_items
           WHERE pantry_id = $1 AND id = $2`,
          [req.pantryId, itemId]
        );

        if (!existing.rowCount) fail(404, 'Pantry batch not found.');
        fail(400, 'Quantity would exceed the maximum.');
      }

      const result = await client.query(
        `${itemSelect} WHERE pi.pantry_id = $1 AND pi.id = $2`,
        [req.pantryId, itemId]
      );

      return result.rows[0];
    });

    res.json(item);
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

function cookUnit(unit) {
  const cleaned = unit.trim().toLowerCase();
  const aliases = new Map([
    ['item', 'items'], ['each', 'items'],
    ['cups', 'cup'], ['pints', 'pint'],
    ['quarts', 'quart'], ['gallons', 'gallon'],
    ['ounces', 'oz'], ['ounce', 'oz'],
    ['lb', 'lbs'], ['pound', 'lbs'], ['pounds', 'lbs'],
    ['teaspoon', 'tsp'], ['teaspoons', 'tsp'],
    ['tablespoon', 'tbsp'], ['tablespoons', 'tbsp'],
  ]);
  return aliases.get(cleaned) ?? cleaned;
}

function readRecipeId(req) {
  const id = Number(req.params.recipeId);

  if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
    fail(400, 'Invalid recipe ID.');
  }

  return id;
}

function formatStockAmount(ticks) {
  const whole = ticks / 10000n;
  const fraction = String(ticks % 10000n)
    .padStart(4, '0')
    .replace(/0+$/, '');

  return fraction ? `${whole}.${fraction}` : String(whole);
}

// Find the stock rows and amounts needed for one full recipe.
async function planRecipeStock(client, pantryId, recipeId, lock = false) {
  const recipe = await client.query(
    `SELECT id FROM pantry_app.recipes
     WHERE id = $1 AND pantry_id = $2`,
    [recipeId, pantryId]
  );

  if (!recipe.rowCount) fail(404, 'Recipe not found in this pantry.');

  const required = await client.query(
    `SELECT ri.ingredient_id, i.name, ri.unit,
            (ri.quantity * 10000)::bigint AS ticks
     FROM pantry_app.recipe_ingredients ri
     JOIN pantry_app.ingredients i ON i.id = ri.ingredient_id
     WHERE ri.recipe_id = $1`,
    [recipeId]
  );

  if (!required.rowCount) fail(400, 'This recipe has no ingredients.');

  const stock = await client.query(
     `SELECT id, ingredient_id, unit, total_cost, cost_basis_quantity,
            (quantity * 10000)::bigint AS ticks
     FROM pantry_app.pantry_items
     WHERE pantry_id = $1
       AND ingredient_id = ANY($2::int[])
       AND quantity > 0
       AND (
         expiration_date IS NULL OR
         expiration_date >= (now() AT TIME ZONE 'America/New_York')::date
       )
     ORDER BY expiration_date NULLS LAST, id
     ${lock ? 'FOR UPDATE' : ''}`,
    [pantryId, required.rows.map((row) => row.ingredient_id)]
  );

  const needs = new Map();

  for (const row of required.rows) {
    const unit = cookUnit(row.unit);
    const key = `${row.ingredient_id}:${unit}`;
    const entry = needs.get(key) ?? { name: row.name, unit, ticks: 0n };
    entry.ticks += BigInt(row.ticks);
    needs.set(key, entry);
  }

  const batches = new Map();

  for (const row of stock.rows) {
    const key = `${row.ingredient_id}:${cookUnit(row.unit)}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(row);
  }

  const deductions = [];
  const shortages = [];

  for (const [key, need] of needs) {
    let remaining = need.ticks;

    for (const row of batches.get(key) ?? []) {
      if (remaining === 0n) break;

      const available = BigInt(row.ticks);
      const take = available < remaining ? available : remaining;
      deductions.push({ row, take });
      remaining -= take;
    }

    if (remaining > 0n) {
      shortages.push(
        `${need.name}: short ${formatStockAmount(remaining)} ${need.unit}`
      );
    }
  }

  return { deductions, shortages };
}

// Deduct one full recipe, starting with the soonest-expiring stock.
router.post(
  '/pantries/:pantryId/recipes/:recipeId/cook',
  requireMember,
  async (req, res) => {
    const pantryId = req.pantryId;
    const recipeId = readRecipeId(req);

    await transaction(async (client) => {
      const { deductions, shortages } = await planRecipeStock(
        client, pantryId, recipeId, true
      );

      if (shortages.length) {
        fail(409, shortages.join('; '));
      }

      for (const { row, take } of deductions) {
        await client.query(
          `UPDATE pantry_app.pantry_items
           SET quantity = quantity - $1::numeric
           WHERE id = $2 AND pantry_id = $3`,
          [formatStockAmount(take), row.id, pantryId]
        );
      }
    });

    res.json({
      cooked: true,
      message: 'Recipe cooked. Pantry quantities were updated. Oldest items deducted first.',
    });
  }
);

const shoppingPath = '/pantries/:pantryId/shopping-list/items';

const shoppingSelect = `
  SELECT si.id, i.name, si.quantity::float8 AS quantity,
         si.unit, si.checked
  FROM pantry_app.shopping_list_items si
  JOIN pantry_app.ingredients i ON i.id = si.ingredient_id
`;

const pantryShoppingListId = `
  SELECT id FROM pantry_app.shopping_lists
  WHERE pantry_id = $1
  ORDER BY id
  LIMIT 1
`;

router.get(shoppingPath, requireMember, async (req, res) => {
  const result = await pool.query(
    `${shoppingSelect}
     WHERE si.shopping_list_id = (${pantryShoppingListId})
     ORDER BY si.checked, lower(i.name), si.id`,
    [req.pantryId]
  );

  res.json(result.rows);
});

router.post(shoppingPath, requireMember, async (req, res) => {
  const { name, quantity, unit } = req.body ?? {};

  if (typeof name !== 'string' || !name.trim() || name.trim().length > 150) {
    fail(400, 'Enter an item name of 1–150 characters.');
  }
  if (typeof unit !== 'string' || !unit.trim() || unit.trim().length > 30) {
    fail(400, 'Enter a unit of 1–30 characters.');
  }
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) ||
      quantity < 0.0001 || quantity > 1000000000) {
    fail(400, 'Enter a positive quantity.');
  }

  const item = await transaction(async (client) => {
    await client.query(
      'SELECT id FROM pantry_app.pantries WHERE id = $1 FOR UPDATE',
      [req.pantryId]
    );

    let list = await client.query(pantryShoppingListId, [req.pantryId]);
    if (!list.rowCount) {
      list = await client.query(
        `INSERT INTO pantry_app.shopping_lists (pantry_id)
         VALUES ($1) RETURNING id`,
        [req.pantryId]
      );
    }

    const ingredientId = await findOrCreateIngredient(client, name.trim());
    const inserted = await client.query(
      `INSERT INTO pantry_app.shopping_list_items
         (shopping_list_id, ingredient_id, quantity, unit)
       VALUES ($1, $2, $3, $4)
       RETURNING id, quantity::float8 AS quantity, unit, checked`,
      [list.rows[0].id, ingredientId, quantity, unit.trim()]
    );

    return { ...inserted.rows[0], name: name.trim() };
  });

  res.status(201).json(item);
});

router.patch(`${shoppingPath}/:itemId`, requireMember, async (req, res) => {
  const id = itemIdFromRequest(req);
  const { checked } = req.body ?? {};
  if (typeof checked !== 'boolean') fail(400, 'checked must be true or false.');

  const saved = await pool.query(
    `UPDATE pantry_app.shopping_list_items
     SET checked = $3
     WHERE shopping_list_id = (${pantryShoppingListId}) AND id = $2
     RETURNING id, checked`,
    [req.pantryId, id, checked]
  );

  if (!saved.rowCount) fail(404, 'Shopping item not found.');
  res.json(saved.rows[0]);
});

router.delete(`${shoppingPath}/:itemId`, requireMember, async (req, res) => {
  const removed = await pool.query(
    `DELETE FROM pantry_app.shopping_list_items
     WHERE shopping_list_id = (${pantryShoppingListId}) AND id = $2`,
    [req.pantryId, itemIdFromRequest(req)]
  );

  if (!removed.rowCount) fail(404, 'Shopping item not found.');
  res.sendStatus(204);
});

router.get(
  '/pantries/:pantryId/recipes/:recipeId/cost',
  requireMember,
  async (req, res) => {
    const { deductions, shortages } = await planRecipeStock(
      pool,
      req.pantryId,
      readRecipeId(req)
    );

    let total = 0;
    let missingPrices = false;

    for (const { row, take } of deductions) {
      if (row.total_cost === null || row.cost_basis_quantity === null) {
        missingPrices = true;
        continue;
      }

      const amountUsed = Number(take) / 10000;
      total += amountUsed * Number(row.total_cost)
        / Number(row.cost_basis_quantity);
    }

    res.json({
      estimated_cost: shortages.length || missingPrices
        ? null
        : Math.round(total * 100) / 100,
      shortages,
      missing_prices: missingPrices,
    });
  }
);


// Create a recipe with its ingredients and steps.
router.post(
  '/pantries/:pantryId/recipes',
  requireMember,
  async (req, res) => {
    const recipe = validateRecipe(req.body);

    const saved = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO pantry_app.recipes
           (
             pantry_id,
             created_by,
             name,
             prep_minutes,
             cook_minutes,
             servings
           )
         VALUES ($1, $2, $3, 0, $4, $5)
         RETURNING id`,
        [
          req.pantryId,
          req.user.id,
          recipe.name,
          recipe.time,
          recipe.servings,
        ]
      );

      const recipeId = result.rows[0].id;

      for (const [index, ingredient] of recipe.ingredients.entries()) {
        const ingredientId = await findOrCreateIngredient(
          client,
          ingredient.name
        );

        await client.query(
          `INSERT INTO pantry_app.recipe_ingredients
             (
               recipe_id,
               ingredient_id,
               quantity,
               unit,
               note,
               position
             )
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            recipeId,
            ingredientId,
            ingredient.quantity,
            ingredient.unit,
            ingredient.note,
            index + 1,
          ]
        );
      }

      for (const [index, instruction] of recipe.steps.entries()) {
        await client.query(
          `INSERT INTO pantry_app.recipe_steps
             (recipe_id, step_number, instruction)
           VALUES ($1, $2, $3)`,
          [recipeId, index + 1, instruction]
        );
      }

      const details = await client.query(
        `${recipeSelect}
         WHERE r.id = $1 AND r.pantry_id = $2`,
        [recipeId, req.pantryId]
      );

      return details.rows[0];
    });

    res.status(201).json(saved);
  }
);

router.get(
  '/pantries/:pantryId/recipe-recommendations',
  requireMember,
  async (req, res) => {
    const result = await pool.query(
      `WITH local_day AS (
         SELECT (now() AT TIME ZONE 'America/New_York')::date AS today
       )
       SELECT r.id, r.name,
              i.id AS ingredient_id, i.name AS ingredient,
              ri.unit AS recipe_unit, pi.unit AS stock_unit,
              to_char(pi.expiration_date, 'YYYY-MM-DD') AS expires
       FROM pantry_app.recipes r
       JOIN pantry_app.recipe_ingredients ri ON ri.recipe_id = r.id
       JOIN pantry_app.ingredients i ON i.id = ri.ingredient_id
       JOIN pantry_app.pantry_items pi
         ON pi.pantry_id = r.pantry_id
        AND pi.ingredient_id = ri.ingredient_id
       CROSS JOIN local_day d
       WHERE r.pantry_id = $1
         AND pi.quantity > 0
         AND pi.expiration_date BETWEEN d.today AND d.today + 3`,
      [req.pantryId]
    );

    const recipes = new Map();

    for (const row of result.rows) {
      if (cookUnit(row.recipe_unit) !== cookUnit(row.stock_unit)) continue;

      if (!recipes.has(row.id)) {
        recipes.set(row.id, {
          id: row.id,
          name: row.name,
          earliest: row.expires,
          ingredients: new Map(),
        });
      }

      const recipe = recipes.get(row.id);
      recipe.ingredients.set(row.ingredient_id, row.ingredient);

      if (row.expires < recipe.earliest) {
        recipe.earliest = row.expires;
      }
    }

    const recommendations = [...recipes.values()]
      .sort((a, b) =>
        a.earliest.localeCompare(b.earliest) ||
        b.ingredients.size - a.ingredients.size ||
        a.name.localeCompare(b.name) ||
        a.id - b.id
      )
      .slice(0, 5)
      .map(({ ingredients, ...recipe }) => ({
        ...recipe,
        ingredients: [...ingredients.values()].sort(),
      }));

    res.json(recommendations);
  }
);

module.exports = router;
