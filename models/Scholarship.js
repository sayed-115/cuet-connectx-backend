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
  scholarshipImage: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Scholarship || mongoose.model('Scholarship', scholarshipSchema);
