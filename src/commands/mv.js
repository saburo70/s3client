const fs = require('fs');
const { CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const client = require('../client');
const { upload, download } = require('./cp');
const { parseS3Uri } = require('../utils');

async function mv(src, dst) {
  const srcIsS3 = src.startsWith('s3://');
  const dstIsS3 = dst.startsWith('s3://');

  if (!srcIsS3 && !dstIsS3) {
    throw new Error('at least one of src or dst must be an s3:// URI');
  }

  if (srcIsS3 && dstIsS3) {
    await s3Move(src, dst);
    return;
  }

  let finalDst;
  if (dstIsS3) {
    finalDst = await upload(src, dst);
    fs.unlinkSync(src);
  } else {
    finalDst = await download(src, dst);
    const { bucket, key } = parseS3Uri(src);
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
  console.log(`Moved: ${src} -> ${finalDst}`);
}

// Server-side copy then delete the source (rename within S3).
async function s3Move(src, dst) {
  const from = parseS3Uri(src);
  const to = parseS3Uri(dst);
  if (!from.key) throw new Error('mv source requires a full object key, e.g. s3://bucket/path/to/file');

  // If dst is a bucket root or a prefix ending in '/', keep the source's basename.
  let destKey = to.key;
  if (!destKey || destKey.endsWith('/')) {
    destKey = (destKey || '') + from.key.split('/').pop();
  }

  // CopySource must be `bucket/key`, with each path segment URL-encoded.
  const copySource = `${from.bucket}/${from.key.split('/').map(encodeURIComponent).join('/')}`;
  await client.send(new CopyObjectCommand({
    Bucket: to.bucket,
    Key: destKey,
    CopySource: copySource,
  }));
  await client.send(new DeleteObjectCommand({ Bucket: from.bucket, Key: from.key }));
  console.log(`Moved: ${src} -> s3://${to.bucket}/${destKey}`);
}

module.exports = mv;
