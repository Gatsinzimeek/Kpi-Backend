
import 'dotenv/config';

import { app } from './app.js';
import { pool } from './db/pool.js';

const port = Number(process.env.PORT) || 5000;

const server = app.listen(port, () => {
  console.log(`KPI API listening on port ${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  server.close(async () => {
    try {
      await pool.end();
      process.exitCode = 0;
    } catch (error) {
      console.error('Error closing database pool:', error.message);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
