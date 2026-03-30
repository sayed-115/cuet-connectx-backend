const sgMail = require('@sendgrid/mail');

const SENDGRID_API_KEY = (process.env.SENDGRID_API_KEY || '').trim();
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.error('[Email] SENDGRID_API_KEY is missing. Email delivery will fail until it is configured.');
}

const FROM_EMAIL = (process.env.EMAIL_USER || '').trim();

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
  if (!SENDGRID_API_KEY) missing.push('SENDGRID_API_KEY');
  if (!FROM_EMAIL) missing.push('EMAIL_USER');

  if (missing.length > 0) {
    throw new Error(`[Email] Missing required email environment variables: ${missing.join(', ')}`);
  }
}

async function sendWithLogging({ to, subject, html, flow, token }) {
  assertEmailConfig();

  try {
    const [response] = await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: 'CUET ConnectX' },
      subject,
      html,
    });

    const messageId = response?.headers?.['x-message-id'] || response?.headers?.['X-Message-Id'] || 'n/a';
    console.log(`[Email][${flow}] SendGrid accepted email`, {
      to,
      from: FROM_EMAIL,
      statusCode: response?.statusCode,
      messageId,
      tokenPreview: tokenForLog(token),
    });

    return response;
  } catch (error) {
    const sgErrors = error?.response?.body?.errors || error?.response?.body || null;
    console.error(`[Email][${flow}] SendGrid send failed`, {
      to,
      from: FROM_EMAIL,
      tokenPreview: tokenForLog(token),
      error: error.message,
      statusCode: error?.code || error?.response?.statusCode,
      sendgrid: sgErrors,
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
