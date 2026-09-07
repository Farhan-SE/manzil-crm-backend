import nodemailer, { Transporter } from 'nodemailer';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// nodemailer 8 randomly picks IPv4/IPv6; force IPv4 only.
const _shared = require('nodemailer/lib/shared');
if (_shared.networkInterfaces) {
  _shared.networkInterfaces = Object.fromEntries(
    Object.entries(_shared.networkInterfaces).map(([k, v]) => [
      k,
      (v as { family: string }[]).filter(a => a.family === 'IPv4'),
    ]),
  );
}

let transporter: Transporter | null = null;

function env(name: string) {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : undefined;
}

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = env('SMTP_HOST');
  const port = Number(env('SMTP_PORT') || 587);
  const user = env('SMTP_USER');
  const pass = env('SMTP_PASS');
  const secure = port === 465;

  if (!host || !user || !pass) throw new Error('Mailer not configured');

  transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

  transporter.verify(err => {
    if (err) console.error('[MAILER VERIFY ERROR]', err.message);
    else console.log('[MAILER] SMTP ready to send emails');
  });

  return transporter;
}

function buildEmailTemplate(heading: string, bodyHtml: string) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8"><title>${heading}</title></head>
  <body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
    <div style="max-width:600px;margin:auto;background:#fff;padding:30px;border-radius:8px;">
      <h2>${heading}</h2>
      ${bodyHtml}
    </div>
  </body>
  </html>`;
}

function buildResetEmailHTML(resetLink: string, name?: string, expiryText = '1 hour') {
  return buildEmailTemplate('Password Reset Request', `
    <p>Dear ${name || 'User'},</p>
    <p>We received a request to reset your password. Click below:</p>
    <p style="text-align:center;"><a href="${resetLink}" style="padding:12px 24px;background:#0519CE;color:#fff;border-radius:6px;text-decoration:none;">Reset Password</a></p>
    <p>This link expires in <b>${expiryText}</b> and can only be used once.</p>
  `);
}

export async function sendMail(to: string, subject: string, html: string) {
  const t = getTransporter();
  return t.sendMail({ from: `"Admin" <${env('SMTP_USER')}>`, to, subject, html });
}

export async function sendResetEmail(params: { to: string; resetLink: string; name?: string; expiryText?: string }) {
  const html = buildResetEmailHTML(params.resetLink, params.name, params.expiryText);
  return sendMail(params.to, 'Password Reset Request', html);
}
