const mongoose = require('mongoose');

const scholarshipSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  organization: { type: String, required: true, maxlength: 100 },
  amount: { type: String, maxlength: 300 },
  eligibility: { type: String, maxlength: 1000 },
  description: { type: String, maxlength: 5000 },
  level: { type: String, maxlength: 100 },
  location: { type: String, maxlength: 120 },
  fundingType: { type: String, maxlength: 120 },
  duration: { type: String, maxlength: 120 },
  benefits: { type: String, maxlength: 1200 },
  deadline: Date,
  link: { type: String, maxlength: 500 },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved',
    index: true
  },
  scholarshipImage: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.models.Scholarship || mongoose.model('Scholarship', scholarshipSchema);
