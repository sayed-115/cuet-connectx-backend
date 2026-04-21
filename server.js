const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const jobRoutes = require('./routes/jobs');
const scholarshipRoutes = require('./routes/scholarships');
const postRoutes = require('./routes/posts');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

const asTrimmed = (value) => (value || '').trim();
const getRouteDefinitions = (router, prefix) =>
  (router.stack || [])
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: `${prefix}${layer.route.path}`,
      methods: Object.keys(layer.route.methods || {}).map((method) => method.toUpperCase()),
    }));

const mongoUrl = asTrimmed(process.env.MONGODB_URI);

const frontendUrl = asTrimmed(process.env.FRONTEND_URL);
const corsFromEnv = asTrimmed(process.env.CORS_ORIGIN)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const defaultOrigins = process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173'];
const allowedOrigins = Array.from(new Set([
  ...corsFromEnv,
  ...(frontendUrl ? [frontendUrl] : []),
  ...defaultOrigins,
]));

const requiredRuntimeEnv = {
  MONGODB_URI: mongoUrl,
  JWT_SECRET: asTrimmed(process.env.JWT_SECRET),
  EMAIL_USER: asTrimmed(process.env.EMAIL_USER),
  EMAIL_PASS: asTrimmed(process.env.EMAIL_PASS),
  FRONTEND_URL: frontendUrl,
};

const missingRequiredEnv = Object.entries(requiredRuntimeEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingRequiredEnv.length > 0) {
  console.warn(`[Config] Missing environment variables: ${missingRequiredEnv.join(', ')}`);
} else {
  console.log('[Config] Required environment variables are loaded for auth/email flows.');
}

if (allowedOrigins.length === 0) {
  console.warn('[Config] No CORS origins configured. Set CORS_ORIGIN and/or FRONTEND_URL.');
}

// Trust first proxy (Render, etc.) so express-rate-limit sees real client IP
app.set('trust proxy', 1);

// Security middleware
app.disable('x-powered-by'); // Hide Express
app.use(helmet());           // Set secure HTTP headers

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn('[CORS] Blocked origin', { origin, allowedOrigins });
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Request size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Connect to MongoDB
if (!mongoUrl) {
  console.error('❌ MongoDB connection string is missing. Set MONGODB_URI.');
  process.exit(1);
}

mongoose.connect(mongoUrl)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    // One-time migration: mark pre-existing users (registered before email verification feature) as verified
    try {
      const User = require('./models/User');
      const result = await User.updateMany(
        { emailVerified: { $ne: true }, emailVerificationToken: { $exists: false } },
        { $set: { emailVerified: true } }
      );
      if (result.modifiedCount > 0) {
        console.log(`✅ Migration: marked ${result.modifiedCount} existing user(s) as email-verified`);
      }
    } catch (migrationErr) {
      console.error('Migration warning:', migrationErr.message);
    }
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

mongoose.connection.on('error', (err) => console.error('MongoDB error:', err));
mongoose.connection.on('disconnected', () => console.warn('⚠️ MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/scholarships', scholarshipRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/admin', adminRoutes);

if (process.env.NODE_ENV !== 'production') {
  app.get('/api/debug/moderation-routes', (req, res) => {
    const moderationRoutes = [
      ...getRouteDefinitions(jobRoutes, '/api/jobs'),
      ...getRouteDefinitions(scholarshipRoutes, '/api/scholarships'),
      ...getRouteDefinitions(adminRoutes, '/api/admin'),
    ].filter((route) => /\/(jobs|scholarships)\/:id\/(approve|reject)$/.test(route.path));

    return res.json({ success: true, moderationRoutes });
  });
}

// Health check
app.get('/api/health', (req, res) => {
  const payload = {
    status: 'ok',
    version: 9,
    message: 'CUET ConnectX API is running!',
  };

  if (process.env.NODE_ENV === 'production') {
    return res.json(payload);
  }

  return res.json({
    ...payload,
    config_status: {
      MONGODB_URI: mongoUrl ? 'set' : 'missing',
      JWT_SECRET: asTrimmed(process.env.JWT_SECRET) ? 'set' : 'missing',
      EMAIL_USER: asTrimmed(process.env.EMAIL_USER) ? 'set' : 'missing',
      EMAIL_PASS: asTrimmed(process.env.EMAIL_PASS) ? 'set' : 'missing',
      SMTP_HOST: asTrimmed(process.env.SMTP_HOST) ? 'set' : 'default(smtp.gmail.com)',
      SMTP_PORT: asTrimmed(process.env.SMTP_PORT) ? 'set' : 'default(587)',
      SMTP_SECURE: asTrimmed(process.env.SMTP_SECURE) ? 'set' : 'default(false)',
      FRONTEND_URL: frontendUrl ? 'set' : 'missing',
      CORS_ORIGIN: corsFromEnv.length > 0 ? 'set' : 'missing',
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  const backendUrl = asTrimmed(process.env.BACKEND_URL);
  const apiUrl = backendUrl ? `${backendUrl.replace(/\/+$/, '')}/api` : `http://localhost:${PORT}/api`;
  console.log(`📍 API: ${apiUrl}`);
  console.log('🌐 Allowed CORS origins:', allowedOrigins);
});
