
import 'dotenv/config';
import path from 'node:path';

const connection =
  process.env.DATABASE_OFFLINE_URL ||
  process.env.DATABASE_ONLINE_URL;

if (!connection) {
  throw new Error(
    'Database URL is missing. Check DATABASE_OFFLINE_URL and DATABASE_ONLINE_URL.',
  );
}

const config = {
  development: {
    client: 'pg',

    connection: {
      connectionString: connection,
      searchPath: ['public'],
    },

    searchPath: ['public'],

    pool: {
      min: 0,
      max: 10,
    },

    migrations: {
      directory: path.resolve(process.cwd(), 'src/db/migrations'),
      tableName: 'knex_migrations',
      extension: 'js',
      schemaName: 'public',
    },

    seeds: {
      directory: path.resolve(process.cwd(), 'src/db/seeds'),
      extension: 'js',
    },
  },
};

export default config;
