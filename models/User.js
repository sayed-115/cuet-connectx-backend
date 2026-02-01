const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Department code mapping
const DEPARTMENT_CODES = {
  '01': 'Civil Engineering',
  '02': 'Electrical & Electronic Engineering',
  '03': 'Mechanical Engineering',
  '04': 'Computer Science & Engineering',
  '05': 'Electronics & Communication Engineering',
  '06': 'Urban & Regional Planning',
  '07': 'Petroleum & Mining Engineering',
  '08': 'Architecture',
  '09': 'Physics',
  '10': 'Chemistry',
  '11': 'Mathematics',
  '12': 'Humanities',
};

const DEPARTMENT_SHORT = {
  '01': 'CE',
  '02': 'EEE',
  '03': 'ME',
  '04': 'CSE',
  '05': 'ECE',
  '06': 'URP',
  '07': 'PME',
  '08': 'ARCH',
  '09': 'PHY',
  '10': 'CHEM',
  '11': 'MATH',
  '12': 'HUM',
};

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [3, 'Name must be at least 3 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  studentId: {
    type: String,
    required: [true, 'Student ID is required'],
    unique: true,
    match: [/^\d{7}$/, 'Student ID must be exactly 7 digits']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  batch: {
    type: Number,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  departmentShort: {
    type: String,
    required: true
  },
  roll: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    enum: ['student', 'alumni'],
    default: 'student'
  },
  profileImage: {
    type: String,
    default: null
  },
  coverImage: {
    type: String,
    default: null
  },
  about: {
    type: String,
    default: '',
    maxlength: [500, 'About section cannot exceed 500 characters']
  },
  address: {
    type: String,
    default: ''
  },
  socialLinks: {
    linkedin: { type: String, default: '' },
    github: { type: String, default: '' },
    facebook: { type: String, default: '' },
    portfolio: { type: String, default: '' }
  },
  currentProfession: {
    type: String,
    default: ''
  },
  previousProfession: {
    type: String,
    default: ''
  },
  researchInterests: [{
    type: String
  }],
  skills: [{
    type: String
  }],
  education: [{
    degree: String,
    institution: String,
    year: String,
    major: String,
    focus: String
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Parse student ID before saving
userSchema.pre('validate', function() {
  if (this.studentId && this.studentId.length === 7) {
    const batchCode = this.studentId.substring(0, 2);
    const deptCode = this.studentId.substring(2, 4);
    const roll = this.studentId.substring(4, 7);
    
    this.batch = 2000 + parseInt(batchCode);
    this.department = DEPARTMENT_CODES[deptCode] || 'Unknown';
    this.departmentShort = DEPARTMENT_SHORT[deptCode] || 'N/A';
    this.roll = roll;
    this.userType = this.batch >= 2020 ? 'student' : 'alumni';
  }
});

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get public profile (without sensitive data)
userSchema.methods.getPublicProfile = function() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

module.exports = mongoose.model('User', userSchema);
