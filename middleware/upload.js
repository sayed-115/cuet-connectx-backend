const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// Build a Cloudinary-backed multer instance for a given folder name
const createUpload = (folder) => {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder,
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 1200, height: 1200, crop: 'limit' }],
    },
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      if (allowed.includes(file.mimetype)) return cb(null, true);
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
    },
  });
};

// Pre-built uploaders per resource type
const profileUpload = createUpload('cuet-connectx/profiles');
const jobUpload = createUpload('cuet-connectx/jobs');
const scholarshipUpload = createUpload('cuet-connectx/scholarships');
const postUpload = createUpload('cuet-connectx/posts');

module.exports = { profileUpload, jobUpload, scholarshipUpload, postUpload };