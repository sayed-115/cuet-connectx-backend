const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true
  },
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  location: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote'],
    default: 'Full-time'
  },
  workMode: {
    type: String,
    enum: ['Remote', 'On-site', 'Hybrid'],
    default: 'On-site'
  },
  salary: {
    min: { type: Number },
    max: { type: Number },
    currency: { type: String, default: 'BDT' }
  },
  description: {
    type: String,
    required: [true, 'Job description is required']
  },
  shortDescription: {
    type: String,
    default: ''
  },
  requirements: [{
    type: String
  }],
  responsibilities: [{
    type: String
  }],
  skills: [{
    type: String
  }],
  experience: {
    type: String,
    default: 'Entry Level'
  },
  applicationDeadline: {
    type: Date
  },
  applyLink: {
    type: String
  },
  applyEmail: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobImage: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  applications: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    appliedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'reviewed', 'accepted', 'rejected'], default: 'pending' }
  }]
}, {
  timestamps: true
});

// Index for search
jobSchema.index({ title: 'text', company: 'text', description: 'text', skills: 'text' });
jobSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Job', jobSchema);
