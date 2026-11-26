import { z } from 'zod';

export const password = z
  .string()
  .min(8, 'Password must contain at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

export const registerBody = z.object({
  fullName: z.string().trim().min(2, 'Full name must contain at least 2 characters'),
  email,
  phone: z.string().trim().min(9, 'Enter a valid phone number'),
  sponsorChildId: z.string().trim().nullish(),
  password,
  requestedRole: z.string().optional(),
});

export const loginBody = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
  requestedRole: z.enum(['sponsor', 'field_officer', 'program_manager', 'admin']).optional(),
});

export const codeBody = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') });
export const emailBody = z.object({ email });
export const tokenBody = z.object({ token: z.string().min(20) });
export const resetBody = z.object({ token: z.string().min(20), newPassword: password });
export const changeBody = z.object({ oldPassword: z.string().min(1), newPassword: password });
