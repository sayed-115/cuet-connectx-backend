const mongoose = require('mongoose');

const scholarshipSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  organization: { type: String, required: true, maxlength: 100 },
  amount: { type: String, maxlength: 50 },
  eligibility: { type: String, maxlength: 1000 },
  description: { type: String, maxlength: 5000 },
  deadline: Date,
  link: { type: String, maxlength: 500 },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  scholarshipImage: { type: String },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: false, updatedAt: true }
});

scholarshipSchema.index({ status: 1, createdAt: -1 });

scholarshipSchema.pre('validate', function syncCreatedBy(next) {
  if (!this.createdBy && this.postedBy) {
    this.createdBy = this.postedBy;
  }
  next();
});

module.exports = mongoose.models.Scholarship || mongoose.model('Scholarship', scholarshipSchema);
