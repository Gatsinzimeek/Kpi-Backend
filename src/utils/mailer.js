import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = env.mail.host
  ? nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.port === 465,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
    })
  : null;

export async function sendMail({ to, subject, text }) {
  if (!transporter) {
    console.log(`\n[mail:dev] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  try {
    await transporter.sendMail({ from: env.mail.from, to, subject, text });
  } catch (e) {
    console.error('Mail error:', e.message); // never break the request because of email
  }
}
