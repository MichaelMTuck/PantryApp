// This file only tests connectivity it does not check for user credentails or shared pantries at this point

require('dotenv').config();

const express = require('express');
const pool = require('./db');
const { router: authRouter } = require('./auth');
const app = express();
const pantryRouter = require('./pantries');

app.use(express.json());
app.use('/api', authRouter);
app.use('/api', pantryRouter);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.json({
      status: 'ok',
      database: 'connected',
    });
  } catch (error) {
    console.error('Database test failed:', error);

    res.status(503).json({
      status: 'error',
      database: 'unavailable',
    });
  }
});

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
app.use((error, req, res, next) => {
  const status =
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status < 500
      ? error.status
      : 500;

  if (status === 500) {
    console.error(error);
  }

  res.status(status).json({
    error: status === 500
      ? 'The server could not complete the request.'
      : error.message,
  });
});
app.listen(port, host, () => {
  console.log(`Pantry API listening on http://${host}:${port}`);
});
