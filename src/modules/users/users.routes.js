import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { requireAuth, requireRole, publicUser } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../middleware/audit.js';
import { createToken } from '../../utils/tokens.js';
import { sendMail } from '../../utils/mailer.js';
import { env } from '../../config/env.js';
import { paging, paged } from '../../utils/pagination.js';
import { badRequest, notFound, conflict } from '../../utils/AppError.js';

const r = Router();
r.use(requireAuth);

// ---- own profile (any role) ----
r.get('/me', (req, res) => res.json({ data: publicUser(req.user) }));
r.patch('/me',
  validate({ body: z.object({ fullName: z.string().trim().min(2).optional(), phone: z.string().trim().min(9).optional() }) }),
  async (req, res) => {
    const { fullName, phone } = req.valid.body;
    const [u] = await db('users').where({ id: req.user.id })
      .update({ full_name: fullName ?? req.user.full_name, phone: phone ?? req.user.phone, updated_at: db.fn.now() }).returning('*');
    res.json({ data: publicUser(u) });
  });

// ---- admin only ----
r.use(requireRole('admin'));

const roles = ['sponsor', 'field_officer', 'program_manager', 'admin'];

r.get('/', validate({ query: z.object({
  role: z.enum(roles).optional(), status: z.enum(['pending', 'active', 'inactive']).optional(),
  search: z.string().optional(), page: z.any().optional(), limit: z.any().optional() }) }),
  async (req, res) => {
    const q = req.valid.query; const p = paging(q);
    const base = db('users')
      .modify((b) => { if (q.role) b.where({ role: q.role }); if (q.status) b.where({ status: q.status });
        if (q.search) b.where((w) => w.whereILike('full_name', `%${q.search}%`).orWhereILike('email', `%${q.search}%`)); });
    const [{ count }] = await base.clone().count();
    const rows = await base.clone().orderBy('created_at', 'desc').limit(p.limit).offset(p.offset);
    res.json(paged(rows.map(publicUser), count, p));
  });

r.post('/', validate({ body: z.object({
  fullName: z.string().trim().min(2), email: z.string().trim().toLowerCase().pipe(z.email()),
  phone: z.string().trim().optional(), role: z.enum(['field_officer', 'program_manager', 'admin']),
  region: z.string().trim().optional() }) }),
  async (req, res) => {
    const b = req.valid.body;
    if (await db('users').where({ email: b.email }).first()) throw conflict('A user with this email already exists');
    const [u] = await db('users').insert({ full_name: b.fullName, email: b.email, phone: b.phone, role: b.role, region: b.region, status: 'pending' }).returning('*');
    const token = await createToken(u.id, 'invite', 72 * 60);
    await sendMail({ to: u.email, subject: 'You have been invited to SponsorTrack',
      text: `Hello ${u.full_name},\n\nSet your password to activate your ${b.role.replace('_', ' ')} account: ${env.clientUrl}/new-password?token=${token}\n\nThe link expires in 72 hours.` });
    await audit(req, 'USER_INVITED', 'user', u.id, { role: b.role });
    res.status(201).json({ data: publicUser(u) });
  });

r.patch('/:id', validate({ params: z.object({ id: z.uuid() }), body: z.object({
  fullName: z.string().trim().min(2).optional(), phone: z.string().optional(), role: z.enum(roles).optional(),
  region: z.string().nullable().optional(), status: z.enum(['active', 'inactive']).optional() }) }),
  async (req, res) => {
    const b = req.valid.body;
    if (req.valid.params.id === req.user.id && (b.status === 'inactive' || (b.role && b.role !== 'admin')))
      throw badRequest('You cannot deactivate or demote your own account');
    const patch = { updated_at: db.fn.now() };
    if (b.fullName) patch.full_name = b.fullName;
    if (b.phone !== undefined) patch.phone = b.phone;
    if (b.role) patch.role = b.role;
    if (b.region !== undefined) patch.region = b.region;
    if (b.status) patch.status = b.status;
    const [u] = await db('users').where({ id: req.valid.params.id }).update(patch).returning('*');
    if (!u) throw notFound('User not found');
    await audit(req, 'USER_UPDATED', 'user', u.id, b);
    res.json({ data: publicUser(u) });
  });

r.delete('/:id', validate({ params: z.object({ id: z.uuid() }) }), async (req, res) => {
  if (req.valid.params.id === req.user.id) throw badRequest('You cannot deactivate your own account');
  const n = await db('users').where({ id: req.valid.params.id }).update({ status: 'inactive' });
  if (!n) throw notFound('User not found');
  await audit(req, 'USER_DEACTIVATED', 'user', req.valid.params.id);
  res.json({ success: true });
});

export default r;
