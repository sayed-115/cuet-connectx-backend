const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

function tokenForLog(token) {
  if (!token) return 'missing';
  if (process.env.NODE_ENV === 'production') return `${token.slice(0, 8)}...`;
  return token;
}

// Rate limiters — prevent brute-force on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

router.use(authLimiter);

// Register
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, studentId } = req.body;

    // Basic validation
    if (!fullName || !email || !password || !studentId) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    // Check if student ID already exists
    const existingStudentId = await User.findOne({ studentId });
    if (existingStudentId) {
      return res.status(400).json({ success: false, message: 'An account with this Student ID already exists' });
    }

    // Create user (password hashing is handled by the User model pre-save hook)
    const emailToken = crypto.randomBytes(32).toString('hex');
    const hashedEmailToken = crypto.createHash('sha256').update(emailToken).digest('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    console.log('[Auth][register] Generated email verification token', {
      email,
      token: tokenForLog(emailToken),
      expiresAt: emailVerificationExpires.toISOString(),
    });

    const user = new User({
      fullName,
      email,
      password,
      studentId,
      emailVerificationToken: hashedEmailToken,
      emailVerificationExpires,
    });

    await user.save();
    console.log('[Auth][register] User created', {
      userId: String(user._id),
      email: user.email,
      emailVerified: user.emailVerified,
    });

    // Send verification email and report delivery status explicitly
    let emailSent = true;
    try {
      await sendVerificationEmail(email, emailToken);
      console.log('[Auth][register] Verification email send requested', {
        userId: String(user._id),
        email: user.email,
      });
    } catch (emailErr) {
      emailSent = false;
      console.error('[Auth][register] Failed to send verification email', {
        userId: String(user._id),
        email: user.email,
        error: emailErr.message,
        sendgrid: emailErr?.response?.body?.errors || emailErr?.response?.body || null,
      });
    }

    res.status(201).json({
      success: true,
      message: emailSent
        ? 'Registration successful! Please check your email to verify your account.'
        : 'Registration successful, but we could not send the verification email. Please use resend verification from the login page.',
      needsVerification: true,
      emailSent,
    });
  } catch (error) {
    console.error('Registration error:', error.message, error);
    // Only expose Mongoose validation messages, not internal details
    if (error.name === 'ValidationError') {
      const msg = Object.values(error.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: msg });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, studentId } = req.body;

    if ((!email && !studentId) || !password) {
      return res.status(400).json({ success: false, message: 'Email/Student ID and password are required' });
    }

    // Find user by email or studentId - include password field for comparison
    const user = await User.findOne(
      email ? { email } : { studentId }
    ).select('+password');
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password using the model method
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Block login if email is not verified
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in. Check your inbox for the verification link.',
        needsVerification: true,
        email: user.email,
      });
    }

    // Generate token
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { 
        id: user._id, 
        _id: user._id,
        fullName: user.fullName, 
        email: user.email, 
        studentId: user.studentId, 
        batch: user.batch, 
        department: user.department,
        departmentShort: user.departmentShort,
        userType: user.userType,
        profileImage: user.profileImage,
        role: user.role,
        status: user.status,
        following: user.following || [],
        followers: user.followers || []
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get current user — reuses auth middleware so banned/inactive users are rejected
const { auth } = require('../middleware/auth');
router.get('/me', auth, async (req, res) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Verify email
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      console.warn('[Auth][verify-email] Missing token in request');
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }

    console.log('[Auth][verify-email] Token received', { token: tokenForLog(token) });

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      console.warn('[Auth][verify-email] Invalid or expired token', { token: tokenForLog(token) });
      return res.status(400).json({ success: false, message: 'Invalid or expired verification link. Please request a new one.' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    console.log('[Auth][verify-email] Email verified successfully', {
      userId: String(user._id),
      email: user.email,
    });

    res.json({ success: true, message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email }).select('+emailVerificationToken +emailVerificationExpires');
    if (!user) {
      // Do not reveal whether the email exists
      return res.json({ success: true, message: 'If your email is registered, you will receive a verification link shortly.' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ success: false, message: 'This email is already verified.' });
    }

    // Generate new token
    const emailToken = crypto.randomBytes(32).toString('hex');
    const hashedEmailToken = crypto.createHash('sha256').update(emailToken).digest('hex');
    user.emailVerificationToken = hashedEmailToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    console.log('[Auth][resend-verification] Generated new token', {
      userId: String(user._id),
      email: user.email,
      token: tokenForLog(emailToken),
      expiresAt: user.emailVerificationExpires.toISOString(),
    });

    try {
      await sendVerificationEmail(email, emailToken);
      console.log('[Auth][resend-verification] Verification email send requested', {
        userId: String(user._id),
        email: user.email,
      });
    } catch (emailErr) {
      console.error('[Auth][resend-verification] Failed to send verification email', {
        userId: String(user._id),
        email: user.email,
        error: emailErr.message,
        sendgrid: emailErr?.response?.body?.errors || emailErr?.response?.body || null,
      });
      return res.status(500).json({ success: false, message: 'Failed to send verification email. Please try again later.' });
    }

    res.json({ success: true, message: 'Verification email sent! Please check your inbox.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Forgot password — send reset link
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, studentId } = req.body;

    if (!email && !studentId) {
      return res.status(400).json({ success: false, message: 'Email or Student ID is required' });
    }

    const user = await User.findOne(email ? { email } : { studentId });

    if (!user) {
      console.log('[Auth][forgot-password] No matching user found', {
        hasEmail: Boolean(email),
        hasStudentId: Boolean(studentId),
      });
      // Don't reveal whether the account exists
      return res.json({ success: true, message: 'If an account with that information exists, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    console.log('[Auth][forgot-password] Generated password reset token', {
      userId: String(user._id),
      email: user.email,
      token: tokenForLog(resetToken),
      expiresAt: user.passwordResetExpires.toISOString(),
    });

    try {
      await sendPasswordResetEmail(user.email, resetToken);
      console.log('[Auth][forgot-password] Password reset email send requested', {
        userId: String(user._id),
        email: user.email,
      });
    } catch (emailErr) {
      console.error('[Auth][forgot-password] Failed to send password reset email', {
        userId: String(user._id),
        email: user.email,
        error: emailErr.message,
        sendgrid: emailErr?.response?.body?.errors || emailErr?.response?.body || null,
      });
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      return res.status(500).json({ success: false, message: 'Failed to send reset email. Please try again later.' });
    }

    res.json({ success: true, message: 'If an account with that information exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reset password — verify token and update password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      console.warn('[Auth][reset-password] Missing token or new password');
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }

    console.log('[Auth][reset-password] Token received', { token: tokenForLog(token) });

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      console.warn('[Auth][reset-password] Invalid or expired reset token', { token: tokenForLog(token) });
      return res.status(400).json({ success: false, message: 'Invalid or expired reset link. Please request a new one.' });
    }

    user.password = newPassword; // Will be hashed by the pre-save hook
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = new Date();
    await user.save();

    console.log('[Auth][reset-password] Password reset successful', {
      userId: String(user._id),
      email: user.email,
      passwordChangedAt: user.passwordChangedAt.toISOString(),
    });

    res.json({ success: true, message: 'Password reset successfully! You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
