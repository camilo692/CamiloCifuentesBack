const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getR2Client } = require('../config/r2');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const PRESIGN_EXPIRES_IN = 300;
const READ_EXPIRES_IN = 3600;
const signedReadCache = new Map();

const signedReadsEnabled = () => {
  if (process.env.R2_SIGNED_READ === 'false') return false;
  if (process.env.R2_SIGNED_READ === 'true') return true;
  return process.env.NODE_ENV === 'production';
};

const keyFromPublicUrl = (url) => {
  if (!url) return null;
  const value = String(url).split('?')[0];
  const base = String(process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  if (base && value.startsWith(`${base}/`)) {
    return decodeURIComponent(value.slice(base.length + 1));
  }
  const r2Dev = value.indexOf('.r2.dev/');
  if (r2Dev !== -1) {
    return decodeURIComponent(value.slice(r2Dev + 8));
  }
  return null;
};

const signReadUrl = async (url) => {
  if (!url || !signedReadsEnabled()) return url;
  const key = keyFromPublicUrl(url);
  if (!key) return url;

  const cached = signedReadCache.get(key);
  if (cached && cached.exp > Date.now()) {
    return cached.url;
  }

  try {
    const client = getR2Client();
    const signed = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      }),
      { expiresIn: READ_EXPIRES_IN }
    );
    signedReadCache.set(key, {
      url: signed,
      exp: Date.now() + (READ_EXPIRES_IN - 300) * 1000,
    });
    return signed;
  } catch {
    return url;
  }
};

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
  sanitizeFilename,
  signReadUrl,
  keyFromPublicUrl,
};
