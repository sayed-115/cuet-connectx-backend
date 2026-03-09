const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');

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
    const user = new User({
      fullName,
      email,
      password,
      studentId
    });

    await user.save();

    // Generate token
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
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
        role: user.role,
        status: user.status,
        following: [],
        followers: []
      }
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

module.exports = router;
