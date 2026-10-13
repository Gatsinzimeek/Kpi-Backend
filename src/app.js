
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { pool } from './db/pool.js';

export const app = express();

app.disable('x-powered-by');

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_OFFLINE_URL || process.env.CLIENT_ONLINE_URL,
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));

app.get('/api/v1/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');

    res.status(200).json({
      success: true,
      message: 'KPI API is running',
      database: 'connected',
    });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use((error, _req, res, _next) => {
  console.error('Request error:', error.message);

  res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred',
  });
});
