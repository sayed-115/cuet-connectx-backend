const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.uploadImage = (filePath, folder) =>
  cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: 'image',
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  });

exports.deleteImage = (imageUrl) => {
  if (!imageUrl) return;
  const parts = imageUrl.split('/');
  const publicIdWithExt = parts[parts.length - 1];
  const publicId = publicIdWithExt.split('.')[0];
  return cloudinary.uploader.destroy(publicId);
};
