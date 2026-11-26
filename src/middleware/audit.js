import { db } from '../db/knex.js';

export async function audit(req, action, entity, entityId, details) {
  try {
    await db('audit_logs').insert({
      user_id: req.user?.id ?? null,
      user_email: req.user?.email ?? details?.email ?? null,
      action,
      entity,
      entity_id: entityId ? String(entityId) : null,
      details: details ? JSON.stringify(details) : null,
      ip: req.ip,
    });
  } catch (e) {
    console.error('Audit write failed:', e.message);
  }
}
