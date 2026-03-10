const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

async function seedAdmin() {
  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI is missing in backend .env');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('Error: Cannot run admin seeder in production environment');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ email: 'admin@cuetconnectx.com' });
    if (existing) {
      console.log('Admin account already exists:');
      console.log(`  Email: ${existing.email}`);
      console.log(`  Student ID: ${existing.studentId}`);
      console.log(`  Role: ${existing.role}`);
      await mongoose.disconnect();
      return;
    }

    const admin = new User({
      fullName: 'CUET ConnectX Admin',
      email: 'admin@cuetconnectx.com',
      studentId: '9904001',
      password: 'admin123',
      role: 'admin',
      status: 'active',
      isActive: true,
      isVerified: true
    });

    await admin.save();

    console.log('Admin account created successfully');
    console.log('  Email: admin@cuetconnectx.com');
    console.log('  Password: admin123');
    console.log('  Student ID: 9904001');
    console.log('  Role: admin');
  } catch (error) {
    console.error('Admin seeder error:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedAdmin();
