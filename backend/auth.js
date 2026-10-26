const express = require('express');
const bcrypt = require('bcryptjs');
const { randomBytes, createHash } = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const pool = require('./db');

const router = express.Router();

// Behind Tailscale Serve, this intentionally limits all clients together.
// Do not enable "trust proxy" without configuring trusted proxies.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many attempts. Try again in 15 minutes.',
  },
});

// Used to perform a password comparison even for unknown accounts.
const dummyHash = bcrypt.hashSync(
  randomBytes(32).toString('hex'),
  12
);

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function normalizeEmail(value) {
  if (typeof value !== 'string') {
    fail(400, 'Email is required.');
  }

  const email = value.trim().toLowerCase();

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    fail(400, 'Enter a valid email address.');
  }

  return email;
}

function validatePassword(password, registering = false) {
  if (
    typeof password !== 'string' ||
    password.length === 0 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    fail(400, 'Password is required and must not exceed 72 bytes.');
  }

  if (registering && password.length < 12) {
    fail(400, 'Use a password with at least 12 characters.');
  }
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

// Return the original token to the client.
// Store only its hash in PostgreSQL.
async function createSession(db, userId) {
  const token = randomBytes(32).toString('hex');

  const result = await db.query(
    `INSERT INTO pantry_app.sessions
       (token_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '7 days')
     RETURNING expires_at`,
    [hashToken(token), userId]
  );

  return {
    token,
    expires_at: result.rows[0].expires_at,
  };
}

// Middleware that later pantry routes can also use.
async function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(header);

  if (!match) {
    fail(401, 'Please log in.');
  }

  const tokenHash = hashToken(match[1]);

  const result = await pool.query(
    `SELECT u.id, u.email, u.display_name
     FROM pantry_app.sessions s
     JOIN pantry_app.users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.expires_at > NOW()`,
    [tokenHash]
  );

  if (!result.rowCount) {
    fail(401, 'Session expired or invalid. Please log in again.');
  }

  req.user = result.rows[0];
  req.tokenHash = tokenHash;

  next();
}

// POST /api/auth/register
router.post('/auth/register', loginLimiter, async (req, res) => {
  const { email, display_name, password } = req.body ?? {};

  const normalizedEmail = normalizeEmail(email);
  validatePassword(password, true);

  if (
    typeof display_name !== 'string' ||
    !display_name.trim() ||
    display_name.trim().length > 100
  ) {
    fail(400, 'Display name must contain 1–100 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO pantry_app.users
         (email, display_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name`,
      [normalizedEmail, display_name.trim(), passwordHash]
    );

    const user = result.rows[0];
    const session = await createSession(client, user.id);

    await client.query('COMMIT');

    res.status(201).json({
      user,
      ...session,
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (
      error.code === '23505' &&
      error.constraint === 'users_email_key'
    ) {
      fail(409, 'An account with that email already exists.');
    }

    throw error;
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};

  const normalizedEmail = normalizeEmail(email);
  validatePassword(password);

  const result = await pool.query(
    `SELECT id, email, display_name, password_hash
     FROM pantry_app.users
     WHERE email = $1`,
    [normalizedEmail]
  );

  const user = result.rows[0];

  const valid = await bcrypt.compare(
    password,
    user ? user.password_hash : dummyHash
  );

  if (!user || !valid) {
    fail(401, 'Incorrect email or password.');
  }

  const session = await createSession(pool, user.id);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
    },
    ...session,
  });
});

// GET /api/me
router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// POST /api/auth/logout
router.post('/auth/logout', requireAuth, async (req, res) => {
  await pool.query(
    'DELETE FROM pantry_app.sessions WHERE token_hash = $1',
    [req.tokenHash]
  );

  res.sendStatus(204);
});

module.exports = { router, requireAuth };
