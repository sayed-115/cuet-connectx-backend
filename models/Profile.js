const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  degree: String,
  institution: String,
  year: String,
  major: String,
  focus: String
}, { _id: true });

const profileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  about: { type: String, maxlength: 500 },
  contactInfo: {
    email: { type: String },
    phone: { type: String },
    address: { type: String }
  },
  professionalInfo: {
    currentPosition: String,
    company: String,
    location: String
  },
  education: [educationSchema],
  skills: [{ type: String }],
  socialLinks: {
    linkedin: String,
    github: String,
    facebook: String,
    portfolio: String
  },
  profileImage: String, // Cloudinary URL
  coverImage: String,
  profileCompletion: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Profile', profileSchema);
