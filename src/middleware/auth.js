import { db } from '../db/knex.js';
import { unauthorized, forbidden } from '../utils/AppError.js';

// Loads the user for the session on every request (so deactivated users lose access immediately)
export async function requireAuth(req, _res, next) {
  const id = req.session?.userId;
  if (!id) throw unauthorized();
  const user = await db('users').where({ id }).first();
  if (!user || user.status !== 'active') {
    req.session.destroy(() => {});
    throw unauthorized('Session is no longer valid');
  }
  req.user = user;
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) throw forbidden();
  next();
};

export const STAFF_ROLES = ['field_officer', 'program_manager', 'admin'];
export const isStaff = (user) => STAFF_ROLES.includes(user.role);

export const publicUser = (u) => ({
  id: u.id,
  fullName: u.full_name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  region: u.region,
  status: u.status,
  mfaEnabled: u.mfa_enabled,
  emailVerified: !!u.email_verified_at,
  lastLoginAt: u.last_login_at,
});

export const ROLE_HOME = {
  sponsor: '/s/dashboard',
  field_officer: '/f/dashboard',
  program_manager: '/p/dashboard',
  admin: '/a/dashboard',
};
