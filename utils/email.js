const { Resend } = require('resend');

// Resend uses HTTPS API (port 443) — works on Render free tier
// where outbound SMTP ports (25/465/587) are blocked.
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'CUET ConnectX <onboarding@resend.dev>';

/**
 * Send email verification link to a newly registered user.
 */
async function sendVerificationEmail(to, token) {
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyLink = `${frontendUrl}/verify-email?token=${token}`;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [to],
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

  if (error) throw new Error(error.message);
}

/**
 * Send password reset link to a user.
 */
async function sendPasswordResetEmail(to, token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [to],
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

  if (error) throw new Error(error.message);
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
