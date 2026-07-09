const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getR2Client } = require('../config/r2');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const PRESIGN_EXPIRES_IN = 300;

const sanitizeFilename = (filename) =>
  filename.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '');

const buildKey = (filename, folder = 'products') => {
  const safeName = sanitizeFilename(filename);
  return `${folder}/${Date.now()}-${safeName}`;
};

const buildPublicUrl = (key) => {
  const base = process.env.R2_PUBLIC_URL.replace(/\/$/, '');
  return `${base}/${key}`;
};

const getPresignedUploadUrl = async ({ filename, contentType, folder = 'products' }) => {
  const key = buildKey(filename, folder);
  const client = getR2Client();

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRES_IN });

  return {
    uploadUrl,
    publicUrl: buildPublicUrl(key),
    key,
    expiresIn: PRESIGN_EXPIRES_IN
  };
};

const uploadBuffer = async ({ buffer, key, contentType }) => {
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType
    })
  );

  return buildPublicUrl(key);
};

module.exports = {
  ALLOWED_TYPES,
  buildKey,
  buildPublicUrl,
  getPresignedUploadUrl,
  uploadBuffer,
  sanitizeFilename
};
