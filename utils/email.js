const nodemailer = require('nodemailer');
const dns = require('dns');

// Resolve smtp.gmail.com via Google Public DNS (c-ares resolver),
// bypassing Render's broken OS-level DNS that can't resolve it.
const resolver = new dns.Resolver();
resolver.setServers(['8.8.8.8', '8.8.4.4']);

let cachedTransporter = null;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  // dns.Resolver.resolve4 uses c-ares (respects setServers), unlike
  // dns.lookup which uses the OS resolver (ignores setServers).
  const addresses = await new Promise((resolve, reject) => {
    resolver.resolve4('smtp.gmail.com', (err, addrs) => {
      if (err) reject(err);
      else resolve(addrs);
    });
  });

  cachedTransporter = nodemailer.createTransport({
    host: addresses[0],
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      servername: 'smtp.gmail.com', // needed for TLS certificate verification
    },
  });

  return cachedTransporter;
}

/**
 * Send email verification link to a newly registered user.
 */
async function sendVerificationEmail(to, token) {
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyLink = `${frontendUrl}/verify-email?token=${token}`;

  const mailOptions = {
    from: `"CUET ConnectX" <${process.env.SMTP_USER}>`,
    to,
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
  };

  const transporter = await getTransporter();
  await transporter.sendMail(mailOptions);
}

/**
 * Send password reset link to a user.
 */
async function sendPasswordResetEmail(to, token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;

  const mailOptions = {
    from: `"CUET ConnectX" <${process.env.SMTP_USER}>`,
    to,
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
  };

  const transporter = await getTransporter();
  await transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
