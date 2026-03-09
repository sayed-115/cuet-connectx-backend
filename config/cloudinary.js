const cloudinary = require('cloudinary').v2;

// CLOUDINARY_URL env var is auto-parsed by the SDK (format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME)
// Calling .config() without args triggers that auto-parse.
cloudinary.config();

module.exports = cloudinary;