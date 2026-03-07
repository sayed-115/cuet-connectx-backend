const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

const args = process.argv.slice(2);

const getArgValue = (flag) => {
  const index = args.findIndex((arg) => arg === flag || arg.startsWith(`${flag}=`));
  if (index === -1) return '';
  const valueFromEquals = args[index].split('=');
  if (valueFromEquals.length > 1) return valueFromEquals.slice(1).join('=').trim();
  return (args[index + 1] || '').trim();
};

const showUsage = () => {
  console.log('Usage:');
  console.log('  npm run make-admin -- --email=user@example.com');
  console.log('  npm run make-admin -- --studentId=2204115');
};

const hasHelpFlag = args.includes('--help') || args.includes('-h');
if (hasHelpFlag) {
  showUsage();
  process.exit(0);
}

const email = getArgValue('--email').toLowerCase();
const studentId = getArgValue('--studentId');

if (!email && !studentId) {
  console.error('Error: provide --email or --studentId');
  showUsage();
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error('Error: MONGODB_URI is missing in backend .env');
  process.exit(1);
}

const run = async () => {
  let query = {};
  if (email) query = { email };
  else query = { studentId };

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const user = await User.findOne(query);
    if (!user) {
      console.error('User not found for query:', query);
      process.exitCode = 1;
      return;
    }

    user.role = 'admin';
    user.status = 'active';
    user.isActive = true;
    await user.save();

    console.log('Admin role granted successfully');
    console.log(`Name: ${user.fullName}`);
    console.log(`Email: ${user.email}`);
    console.log(`Student ID: ${user.studentId}`);
    console.log(`Role: ${user.role}`);
    console.log(`Status: ${user.status}`);
  } catch (error) {
    console.error('Failed to grant admin role:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
