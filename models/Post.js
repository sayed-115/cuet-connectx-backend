const mongoose = require('mongoose');

const OPPORTUNITY_TYPES = ['job', 'scholarship'];

const postSchema = new mongoose.Schema({
  // Opportunity post fields (job/scholarship)
  title: {
    type: String,
    trim: true,
    maxlength: 200,
    required: function isTitleRequired() {
      return ['job', 'scholarship'].includes(this.type);
    },
  },
  description: {
    type: String,
    trim: true,
    maxlength: 5000,
    required: function isDescriptionRequired() {
      return ['job', 'scholarship'].includes(this.type);
    },
  },
  type: {
    type: String,
    enum: ['job', 'scholarship', 'community'],
    default: 'community',
    required: true,
  },
  providerName: {
    type: String,
    trim: true,
    maxlength: 200,
    required: function isProviderRequired() {
      return ['job', 'scholarship'].includes(this.type);
    },
  },
  deadline: {
    type: Date,
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function isCreatedByRequired() {
      return OPPORTUNITY_TYPES.includes(this.type);
    },
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user',
    required: true,
  },
  status: {
    type: String,
    enum: ['approved', 'pending', 'rejected'],
    default: 'pending',
    required: true,
  },

  // Legacy community post fields (kept for backward compatibility)
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: { type: String, maxlength: 5000 },
  image: { type: String, maxlength: 500 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

postSchema.pre('validate', function applyOpportunityDefaults(next) {
  if (!OPPORTUNITY_TYPES.includes(this.type)) {
    if (!this.status) this.status = 'approved';
    if (!this.role) this.role = 'user';
    return next();
  }

  if (!this.role) {
    this.role = 'user';
  }

  if (!this.status) {
    this.status = this.role === 'admin' ? 'approved' : 'pending';
  }

  next();
});

postSchema.index({ type: 1, createdAt: -1 });
postSchema.index({ createdBy: 1, createdAt: -1 });
postSchema.index({ type: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.Post || mongoose.model('Post', postSchema);
