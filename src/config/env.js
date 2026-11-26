import 'dotenv/config';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_OFFLINE_URL || process.env.CLIENT_ONLINE_URL || 'http://localhost:5173',
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  sessionTimeoutMs: (Number(process.env.SESSION_TIMEOUT_MINUTES) || 30) * 60 * 1000,
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  mail: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'SponsorTrack <no-reply@sponsortrack.org>',
  },
};

if (env.isProd && env.sessionSecret.startsWith('dev-only')) {
  throw new Error('SESSION_SECRET must be set in production');
}
