import knex from 'knex';
import pg from 'pg';
import config from '../../knexfile.js';

// Return DATE columns as 'YYYY-MM-DD' strings (not JS Dates shifted by timezone)
pg.types.setTypeParser(1082, (v) => v);

export const db = knex(config);
