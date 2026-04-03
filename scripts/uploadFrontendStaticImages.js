const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const cloudinary = require('../config/cloudinary');

const sourceDir = path.resolve(__dirname, '..', '..', 'cuet-connectx-frontend', 'src', 'assets', 'images');

const assets = [
  { key: 'above', file: 'above.jpg', width: 2200 },
  { key: 'centralfield', file: 'centralfield.jpg', width: 2200 },
  { key: 'flower', file: 'flower.jpg', width: 2200 },
  { key: 'gate', file: 'gate.jpg', width: 2200 },
  { key: 'gym', file: 'gym.jpg', width: 2200 },
  { key: 'incubator', file: 'incubator.jpg', width: 2200 },
  { key: 'monument', file: 'monument.jpg', width: 2200 },
  { key: 'registry', file: 'registry.jpg', width: 2200 },
  { key: 'tsc', file: 'TSC.jpg', width: 2200 },
  { key: 'coverDefault', file: 'cover.png', width: 1800 },
];

function buildOptimizedUrl(publicId, width) {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      { quality: 'auto', fetch_format: 'auto', dpr: 'auto', width, crop: 'limit' },
    ],
  });
}

async function uploadAll() {
  if (!process.env.CLOUDINARY_URL) {
    throw new Error('CLOUDINARY_URL is missing in backend .env');
  }

  const cloudName = cloudinary.config().cloud_name;
  if (!cloudName) {
    throw new Error('Cloudinary cloud_name could not be resolved from CLOUDINARY_URL');
  }

  const output = {};

  for (const asset of assets) {
    const localPath = path.join(sourceDir, asset.file);
    const publicId = `cuet-connectx/frontend/static/${asset.key}`;

    const uploadResult = await cloudinary.uploader.upload(localPath, {
      public_id: publicId,
      overwrite: true,
      resource_type: 'image',
      use_filename: false,
      unique_filename: false,
      invalidate: true,
    });

    output[asset.key] = buildOptimizedUrl(uploadResult.public_id, asset.width);
    console.log(`Uploaded ${asset.file} -> ${uploadResult.public_id}`);
  }

  console.log('\nUse these URLs in frontend config:\n');
  console.log(JSON.stringify(output, null, 2));
}

uploadAll().catch((err) => {
  console.error('Upload failed:', err.message);
  process.exit(1);
});
