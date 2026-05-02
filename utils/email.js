const nodemailer = require('nodemailer');

const SMTP_HOST = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
const SMTP_PORT = Number((process.env.SMTP_PORT || '587').trim());
const SMTP_SECURE = (process.env.SMTP_SECURE || '').trim().toLowerCase() === 'true' || SMTP_PORT === 465;
const FROM_EMAIL = (process.env.EMAIL_USER || '').trim();
const EMAIL_PASS = (process.env.EMAIL_PASS || '').trim();
const FROM_NAME = (process.env.EMAIL_FROM_NAME || 'CUET ConnectX').trim();

let transporter = null;

function getFrontendUrl() {
  const frontendUrl = (process.env.FRONTEND_URL || '').trim();
  if (!frontendUrl) {
    console.warn('[Email] FRONTEND_URL is missing. Using fallback http://localhost:5173 for email links.');
    return 'http://localhost:5173';
  }
  return frontendUrl.replace(/\/+$/, '');
}

function tokenForLog(token) {
  if (!token) return 'missing';
  if (process.env.NODE_ENV === 'production') return `${token.slice(0, 8)}...`;
  return token;
}

function assertEmailConfig() {
  const missing = [];
  if (!FROM_EMAIL) missing.push('EMAIL_USER');
  if (!EMAIL_PASS) missing.push('EMAIL_PASS');
  if (!Number.isFinite(SMTP_PORT)) missing.push('SMTP_PORT');

  if (missing.length > 0) {
    throw new Error(`[Email] Missing required email environment variables: ${missing.join(', ')}`);
  }
}

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    family: 4, // Force IPv4 to avoid ENETUNREACH errors on some hosting providers
    auth: {
      user: FROM_EMAIL,
      pass: EMAIL_PASS,
    },
  });

  return transporter;
}

async function sendWithLogging({ to, subject, html, flow, token }) {
  assertEmailConfig();

  try {
    const response = await getTransporter().sendMail({
      to,
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      subject,
      html,
    });

    console.log(`[Email][${flow}] SMTP accepted email`, {
      to,
      from: FROM_EMAIL,
      smtpHost: SMTP_HOST,
      smtpPort: SMTP_PORT,
      secure: SMTP_SECURE,
      accepted: response?.accepted || [],
      rejected: response?.rejected || [],
      response: response?.response || null,
      messageId: response?.messageId || 'n/a',
      tokenPreview: tokenForLog(token),
    });

    return response;
  } catch (error) {
    console.error(`[Email][${flow}] SMTP send failed`, {
      to,
      from: FROM_EMAIL,
      smtpHost: SMTP_HOST,
      smtpPort: SMTP_PORT,
      secure: SMTP_SECURE,
      tokenPreview: tokenForLog(token),
      error: error.message,
      code: error?.code || null,
      command: error?.command || null,
      response: error?.response || null,
    });
    throw error;
  }
}

/**
 * Send email verification link to a newly registered user.
 */
async function sendVerificationEmail(to, token) {
  const frontendUrl = getFrontendUrl();
  const verifyLink = `${frontendUrl}/verify-email?token=${token}`;

  await sendWithLogging({
    to,
    token,
    flow: 'verification',
    subject: 'Verify Your Email — CUET ConnectX',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0;">
          <h1 style="color: #0d9488; margin: 0;">CUET ConnectX</h1>
        </div>
        <div style="background: #f9fafb; border-radius: 12px; padding: 32px; text-align: center;">
          <h2 style="color: #1f2937; margin-top: 0;">Verify Your Email Address</h2>
          <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
            Thank you for registering! Please click the button below to verify your email address and activate your account.
          </p>
          <a href="${verifyLink}"
             style="display: inline-block; background: #0d9488; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 20px 0;">
            Verify Email
          </a>
          <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">
            This link expires in 24 hours.<br/>
            If you did not create an account, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${verifyLink}" style="color: #0d9488; word-break: break-all;">${verifyLink}</a>
          </p>
        </div>
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
          &copy; 2026 CUET ConnectX. All rights reserved.
        </p>
      </div>
    `,
  });
}

/**
 * Send password reset link to a user.
 */
async function sendPasswordResetEmail(to, token) {
  const frontendUrl = getFrontendUrl();
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;

  await sendWithLogging({
    to,
    token,
    flow: 'password-reset',
    subject: 'Reset Your Password — CUET ConnectX',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0;">
          <h1 style="color: #0d9488; margin: 0;">CUET ConnectX</h1>
        </div>
        <div style="background: #f9fafb; border-radius: 12px; padding: 32px; text-align: center;">
          <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>
          <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
            We received a request to reset your password. Click the button below to choose a new password.
          </p>
          <a href="${resetLink}"
             style="display: inline-block; background: #0d9488; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 20px 0;">
            Reset Password
          </a>
          <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">
            This link expires in 10 minutes.<br/>
            If you did not request a password reset, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${resetLink}" style="color: #0d9488; word-break: break-all;">${resetLink}</a>
          </p>
        </div>
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
          &copy; 2026 CUET ConnectX. All rights reserved.
        </p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
