import crypto from 'node:crypto';
import { db } from '../db/knex.js';

const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

export async function createToken(userId, type, ttlMinutes) {
  const token = crypto.randomBytes(32).toString('hex');
  await db('email_tokens').where({ user_id: userId, type }).whereNull('used_at').del();
  await db('email_tokens').insert({
    user_id: userId,
    type,
    token_hash: hash(token),
    expires_at: new Date(Date.now() + ttlMinutes * 60000),
  });
  return token;
}

export async function consumeToken(token, type) {
  const row = await db('email_tokens')
    .where({ token_hash: hash(token), type })
    .whereNull('used_at')
    .where('expires_at', '>', new Date())
    .first();
  if (!row) return null;
  await db('email_tokens').where({ id: row.id }).update({ used_at: new Date() });
  return row.user_id;
}
