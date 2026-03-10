const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Department code mapping
const DEPARTMENT_CODES = {
  '01': 'Civil Engineering',
  '02': 'Electrical & Electronic Engineering',
  '03': 'Mechanical Engineering',
  '04': 'Computer Science & Engineering',
  '05': 'Urban & Regional Planning',
  '06': 'Architecture',
  '07': 'Petroleum & Mining Engineering',
  '08': 'Electronics & Telecommunication Engineering',
  '09': 'Mechatronics & Industrial Engineering',
  '10': 'Water Resources Engineering',
  '11': 'Biomedical Engineering',
  '12': 'Materials Science & Engineering',
};

const DEPARTMENT_SHORT = {
  '01': 'CE',
  '02': 'EEE',
  '03': 'ME',
  '04': 'CSE',
  '05': 'URP',
  '06': 'ARCH',
  '07': 'PME',
  '08': 'ETE',
  '09': 'MIE',
  '10': 'WRE',
  '11': 'BME',
  '12': 'MSE',
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
  role: {
    type: String,
    enum: ['student', 'alumni', 'admin'],
    default: 'student'
  },
  status: {
    type: String,
    enum: ['active', 'banned'],
    default: 'active'
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
  contactEmail: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  education: [{
    degree: String,
    institution: String,
    year: String,
    major: String,
    focus: String,
    gpa: String
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
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  passwordChangedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Parse a CUET student ID (YYDDRRR) into its components
function parseStudentId(studentId) {
  if (!studentId || !/^\d{7}$/.test(studentId)) {
    return null;
  }

  const batchCode = studentId.substring(0, 2);
  const departmentCode = studentId.substring(2, 4);
  const rollNumber = studentId.substring(4, 7);

  return {
    batchYear: 2000 + parseInt(batchCode, 10),
    departmentCode,
    departmentName: DEPARTMENT_CODES[departmentCode] || 'Unknown Department',
    rollNumber,
  };
}

// Parse student ID before saving
userSchema.pre('validate', function() {
  const parsed = parseStudentId(this.studentId);
  if (parsed) {
    this.batch = parsed.batchYear;
    this.department = parsed.departmentName;
    this.departmentShort = DEPARTMENT_SHORT[parsed.departmentCode] || 'N/A';
    this.roll = parsed.rollNumber;
    this.userType = parsed.batchYear >= 2020 ? 'student' : 'alumni';
    // Only auto-assign role during initial registration.
    // This prevents the hook from overriding admin-set role changes.
    if (this.isNew && this.role !== 'admin') {
      this.role = this.userType;
    }
  }
});

// Expose parseStudentId as a static method on the model
userSchema.statics.parseStudentId = parseStudentId;

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
