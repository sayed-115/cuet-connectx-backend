const mongoose = require('mongoose');

const scholarshipSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  organization: { type: String, required: true, maxlength: 100 },
  amount: { type: String, maxlength: 50 },
  eligibility: { type: String, maxlength: 1000 },
  description: { type: String, maxlength: 5000 },
  deadline: Date,
  link: { type: String, maxlength: 500 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  scholarshipImage: { type: String }
}, {
  timestamps: true
});

scholarshipSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Scholarship', scholarshipSchema);
