const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const USE_S3 = process.env.AWS_BUCKET_NAME ? true : false;

// ── Local storage fallback (used when S3 env vars not set) ──
// In production (Day 10) we'll switch to real S3
const localStorage = multer.memoryStorage();

// ── S3 Upload Function ────────────────────────────────────────
async function uploadToS3(file) {
  const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const ext = path.extname(file.originalname);
  const key = `products/${uuidv4()}${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));

  return `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${key}`;
}

// ── Main upload handler ───────────────────────────────────────
// Returns middleware + a function to get the final URL
const upload = multer({
  storage: localStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'));
    }
  },
});

async function getImageUrl(file) {
  if (!file) return null;

  if (USE_S3) {
    return await uploadToS3(file);
  }

  // Local fallback — return a placeholder URL
  // In production this becomes a real S3 URL
  return `https://picsum.photos/seed/${uuidv4()}/400/400`;
}

module.exports = { upload, getImageUrl };
