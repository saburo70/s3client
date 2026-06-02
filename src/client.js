require('dotenv').config();
const { S3Client } = require('@aws-sdk/client-s3');

const required = ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Error: missing required environment variable ${key}`);
    console.error('Copy .env.example to .env and fill in your credentials.');
    process.exit(1);
  }
}

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'eu-south-mil',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

module.exports = client;
