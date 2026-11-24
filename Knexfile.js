import 'dotenv/config';

const connection = process.env.DATABASE_OFFLINE_URL || process.env.DATABASE_ONLINE_URL;

export default {
  client: 'pg',
  connection,
  pool: { min: 0, max: 10 },
  migrations: { directory: './src/db/migrations' },
  seeds: { directory: './src/db/seeds' },
};
