import argon2 from 'argon2';
import { generateSecret, generateURI, verify } from 'otplib';
import { db } from '../../db/knex.js';
import { env } from '../../config/env.js';
import { publicUser, ROLE_HOME, isStaff } from '../../middleware/auth.js';
import { audit } from '../../middleware/audit.js';
import { AppError, badRequest, forbidden, unauthorized } from '../../utils/AppError.js';
import { createToken, consumeToken } from '../../utils/tokens.js';
import { sendMail } from '../../utils/mailer.js';

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
// Used so unknown emails cost the same time as wrong passwords
const DUMMY_HASH = await argon2.hash('dummy-password-for-timing');

const regenerate = (req) => new Promise((res, rej) => req.session.regenerate((e) => (e ? rej(e) : res())));
const save = (req) => new Promise((res, rej) => req.session.save((e) => (e ? rej(e) : res())));

async function startSession(req, user) {
  await regenerate(req); // prevents session fixation
  req.session.userId = user.id;
  await save(req);
  await db('users').where({ id: user.id }).update({ last_login_at: new Date(), failed_login_count: 0, locked_until: null });
}

const normalizeRole = (r) => (r || '').toLowerCase().replace(/[\s-]+/g, '_');

export async function register(req, res) {
  const b = req.valid.body;
  const role = normalizeRole(b.requestedRole || 'sponsor');
  if (role !== 'sponsor') {
    throw forbidden('Staff accounts are created by an administrator. Only sponsors can self-register.');
  }
  const existing = await db('users').where({ email: b.email }).first();
  const generic = { success: true, message: 'Account created. Please check your email to verify your account.' };
  if (existing) return res.status(201).json(generic); // do not reveal registered emails

  const [user] = await db('users')
    .insert({
      full_name: b.fullName,
      email: b.email,
      phone: b.phone,
      role: 'sponsor',
      status: 'pending',
      password_hash: await argon2.hash(b.password),
    })
    .returning('*');

  if (b.sponsorChildId) {
    const child = await db('children').whereRaw('lower(code) = ?', [b.sponsorChildId.toLowerCase()]).first();
    if (child) {
      await db('sponsorships').insert({ sponsor_id: user.id, child_id: child.id, status: 'pending' });
    }
  }

  const token = await createToken(user.id, 'verify_email', 60 * 24);
  await sendMail({
    to: user.email,
    subject: 'Verify your SponsorTrack account',
    text: `Hello ${user.full_name},\n\nVerify your email: ${env.clientUrl}/verify-email?token=${token}\n\nThis link expires in 24 hours.`,
  });
  await audit({ ...req, user }, 'REGISTER', 'user', user.id);
  res.status(201).json(generic);
}

export async function verifyEmail(req, res) {
  const userId = await consumeToken(req.valid.body.token, 'verify_email');
  if (!userId) throw badRequest('This verification link is invalid or has expired');
  await db('users').where({ id: userId }).update({ email_verified_at: new Date(), status: 'active' });
  res.json({ success: true, message: 'Email verified. You can now sign in.' });
}

export async function login(req, res) {
  const { email, password, requestedRole } = req.valid.body;
  const user = await db('users').where({ email }).first();
  const log = (success, userId) =>
    db('login_attempts').insert({ email, user_id: userId ?? null, success, ip: req.ip, user_agent: req.get('user-agent')?.slice(0, 250) });

  if (user?.locked_until && user.locked_until > new Date()) {
    await log(false, user.id);
    throw new AppError(429, 'Account temporarily locked after too many failed attempts. Try again later.');
  }

  const ok = await argon2.verify(user?.password_hash || DUMMY_HASH, password).catch(() => false);
  if (!user || !ok) {
    await log(false, user?.id);
    if (user) {
      const fails = user.failed_login_count + 1;
      await db('users').where({ id: user.id }).update({
        failed_login_count: fails,
        locked_until: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
      });
    }
    throw unauthorized('Invalid email or password.');
  }
  if (!user.email_verified_at) throw forbidden('Please verify your email before signing in.');
  if (user.status !== 'active') throw forbidden('This account is not active. Contact your administrator.');
  if (requestedRole && requestedRole !== user.role) {
    await log(false, user.id);
    throw unauthorized('Invalid email or password.'); // do not leak the real role
  }

  await log(true, user.id);

  if (user.mfa_enabled) {
    await regenerate(req);
    req.session.pendingMfaUserId = user.id;
    req.session.pendingMfaAt = Date.now();
    await save(req);
    return res.json({ success: true, mfaRequired: true, redirectUrl: '/2factor' });
  }

  await startSession(req, user);
  await audit({ ...req, user }, 'LOGIN', 'user', user.id);
  res.json({
    success: true,
    user: publicUser(user),
    mfaSetupRequired: isStaff(user), // staff must enable MFA (spec): frontend can nudge to settings
    redirectUrl: ROLE_HOME[user.role],
  });
}

export async function verifyMfaLogin(req, res) {
  const id = req.session.pendingMfaUserId;
  if (!id || Date.now() - (req.session.pendingMfaAt || 0) > 5 * 60000) throw unauthorized('Sign in again to continue');
  const user = await db('users').where({ id }).first();
  const result = await verify({ secret: user.mfa_secret, token: req.valid.body.code, epochTolerance: 30 });
  if (!result.valid) throw unauthorized('Invalid verification code');
  await startSession(req, user);
  await audit({ ...req, user }, 'LOGIN_MFA', 'user', user.id);
  res.json({ success: true, user: publicUser(user), redirectUrl: ROLE_HOME[user.role] });
}

export async function logout(req, res) {
  await audit(req, 'LOGOUT', 'user', req.user?.id);
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.json({ success: true });
  });
}

export const me = (req, res) =>
  res.json({ success: true, user: publicUser(req.user), redirectUrl: ROLE_HOME[req.user.role] });

// ---- MFA enrolment (logged-in users) ----
export async function mfaSetup(req, res) {
  if (req.user.mfa_enabled) throw badRequest('Two-factor authentication is already enabled');
  const secret = generateSecret();
  await db('users').where({ id: req.user.id }).update({ mfa_secret: secret });
  res.json({
    success: true,
    secret,
    otpauthUrl: generateURI({ issuer: 'SponsorTrack', label: req.user.email, secret }),
  });
}

export async function mfaEnable(req, res) {
  const user = await db('users').where({ id: req.user.id }).first();
  if (!user.mfa_secret) throw badRequest('Start setup first');
  const result = await verify({ secret: user.mfa_secret, token: req.valid.body.code, epochTolerance: 30 });
  if (!result.valid) throw badRequest('Invalid verification code');
  await db('users').where({ id: user.id }).update({ mfa_enabled: true });
  await audit(req, 'MFA_ENABLED', 'user', user.id);
  res.json({ success: true, message: 'Two-factor authentication enabled' });
}

// ---- Passwords ----
export async function forgotPassword(req, res) {
  const user = await db('users').where({ email: req.valid.body.email }).first();
  if (user && user.status !== 'inactive') {
    const token = await createToken(user.id, 'reset_password', 30);
    await sendMail({
      to: user.email,
      subject: 'Reset your SponsorTrack password',
      text: `Reset your password: ${env.clientUrl}/new-password?token=${token}\n\nThis link expires in 30 minutes. If you did not ask for it, ignore this email.`,
    });
  }
  res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
}

export async function resetPassword(req, res) {
  const userId = await consumeToken(req.valid.body.token, 'reset_password');
  const inviteId = userId ? null : await consumeToken(req.valid.body.token, 'invite');
  const id = userId || inviteId;
  if (!id) throw badRequest('This link is invalid or has expired');
  await db('users').where({ id }).update({
    password_hash: await argon2.hash(req.valid.body.newPassword),
    email_verified_at: db.fn.now(),
    status: 'active',
    failed_login_count: 0,
    locked_until: null,
  });
  res.json({ success: true, message: 'Password updated. You can now sign in.' });
}

export async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.valid.body;
  const ok = await argon2.verify(req.user.password_hash, oldPassword).catch(() => false);
  if (!ok) throw badRequest('Your current password is incorrect');
  await db('users').where({ id: req.user.id }).update({ password_hash: await argon2.hash(newPassword) });
  await audit(req, 'PASSWORD_CHANGED', 'user', req.user.id);
  res.json({ success: true, message: 'Password changed' });
}
