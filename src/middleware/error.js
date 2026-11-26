import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export const notFoundHandler = (_req, res) =>
  res.status(404).json({ success: false, message: 'Route not found' });

export function errorHandler(error, _req, res, _next) {
  if (error instanceof AppError) {
    return res.status(error.status).json({ success: false, message: error.message, errors: error.details });
  }
  if (error.code === '23505') return res.status(409).json({ success: false, message: 'That record already exists' });
  if (error.code === '23503') return res.status(409).json({ success: false, message: 'Related record not found or still in use' });
  if (error.code === '22P02') return res.status(400).json({ success: false, message: 'Invalid identifier' });
  if (error.name === 'MulterError') return res.status(400).json({ success: false, message: error.message });
  console.error('Request error:', error.message, env.isProd ? '' : error.stack);
  res.status(500).json({ success: false, message: 'An unexpected server error occurred' });
}
