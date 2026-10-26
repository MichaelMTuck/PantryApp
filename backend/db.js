require('dotenv').config();

const { Pool } = require('pg');

// Use the PostgreSQL settings from .env.
const pool = new Pool({
  max: 5,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (error) => {
  console.error('Database connection error:', error);
});

module.exports = pool;
