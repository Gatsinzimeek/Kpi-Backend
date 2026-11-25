import knex from 'knex';
import pg from 'pg';
import config from '../../knexfile.js';

// Return PostgreSQL DATE columns as YYYY-MM-DD strings.
pg.types.setTypeParser(1082, (value) => value);

export const db = knex(config.development);
