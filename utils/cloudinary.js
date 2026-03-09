const cloudinary = require('../config/cloudinary');

exports.uploadImage = (filePath, folder) =>
  cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: 'image',
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  });

exports.deleteImage = (imageUrl) => {
  if (!imageUrl || !imageUrl.includes('res.cloudinary.com')) return;
  // Extract public_id from Cloudinary URL (everything after /upload/vXXX/)
  const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
  if (!match) return;
  const publicId = match[1];
  return cloudinary.uploader.destroy(publicId);
};
