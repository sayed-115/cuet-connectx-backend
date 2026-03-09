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

// Trust first proxy (Render, etc.) so express-rate-limit sees real client IP
app.set('trust proxy', 1);

// Security middleware
app.disable('x-powered-by'); // Hide Express
app.use(helmet());           // Set secure HTTP headers

// Parse CORS origins from env (comma-separated)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(o => o.trim());

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Request size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: 5, message: 'CUET ConnectX API is running!' });
});

// Diagnostic: test SMTP DNS resolution from Render
app.get('/api/health/smtp-test', async (req, res) => {
  const dns = require('dns');
  const resolver = new dns.Resolver();
  resolver.setServers(['8.8.8.8', '8.8.4.4']);
  const results = { osLookup: null, caresResolve: null };

  // Test 1: OS-level dns.lookup (getaddrinfo)
  try {
    const addr = await new Promise((resolve, reject) => {
      dns.lookup('smtp.gmail.com', (err, address) => {
        if (err) reject(err); else resolve(address);
      });
    });
    results.osLookup = { success: true, address: addr };
  } catch (e) {
    results.osLookup = { success: false, error: e.message };
  }

  // Test 2: c-ares resolver with Google DNS
  try {
    const addrs = await new Promise((resolve, reject) => {
      resolver.resolve4('smtp.gmail.com', (err, addresses) => {
        if (err) reject(err); else resolve(addresses);
      });
    });
    results.caresResolve = { success: true, addresses: addrs };
  } catch (e) {
    results.caresResolve = { success: false, error: e.message };
  }

  // Test 3: Quick TCP probe to first resolved IP on port 587
  if (results.caresResolve?.success && results.caresResolve.addresses.length > 0) {
    const net = require('net');
    const ip = results.caresResolve.addresses[0];
    try {
      await new Promise((resolve, reject) => {
        const sock = net.connect({ host: ip, port: 587, timeout: 5000 }, () => {
          sock.destroy();
          resolve();
        });
        sock.on('error', reject);
        sock.on('timeout', () => { sock.destroy(); reject(new Error('TCP connect timed out')); });
      });
      results.tcpProbe = { success: true, host: ip, port: 587 };
    } catch (e) {
      results.tcpProbe = { success: false, host: ip, port: 587, error: e.message };
    }
  }

  res.json(results);
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
  console.log(`📍 API: http://localhost:${PORT}/api`);
});
