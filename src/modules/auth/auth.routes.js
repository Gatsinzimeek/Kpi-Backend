import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import * as s from './auth.schemas.js';
import * as c from './auth.controller.js';

const limiter = (limit) => rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' } });

const r = Router();
r.post('/register', limiter(20), validate({ body: s.registerBody }), c.register);
r.post('/verify-email', limiter(30), validate({ body: s.tokenBody }), c.verifyEmail);
r.post('/login', limiter(30), validate({ body: s.loginBody }), c.login);
r.post('/mfa/verify', limiter(15), validate({ body: s.codeBody }), c.verifyMfaLogin);
r.post('/forgot-password', limiter(10), validate({ body: s.emailBody }), c.forgotPassword);
r.post('/reset-password', limiter(10), validate({ body: s.resetBody }), c.resetPassword);

r.use(requireAuth);
r.get('/me', c.me);
r.post('/logout', c.logout);
r.post('/change-password', validate({ body: s.changeBody }), c.changePassword);
r.post('/mfa/setup', c.mfaSetup);
r.post('/mfa/enable', validate({ body: s.codeBody }), c.mfaEnable);
export default r;
