import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { badRequest } from '../utils/AppError.js';

fs.mkdirSync(env.uploadDir, { recursive: true });

const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export const upload = multer({
  storage: multer.diskStorage({
    destination: env.uploadDir,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.has(file.mimetype) ? cb(null, true) : cb(badRequest('Only PDF, JPG, PNG or WEBP files are allowed')),
});
