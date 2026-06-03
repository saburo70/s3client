const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Transform } = require('stream');
const { HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const client = require('../client');
const { parseS3Uri, createProgressBar } = require('../utils');

async function cp(src, dst) {
  const srcIsS3 = src.startsWith('s3://');
  const dstIsS3 = dst.startsWith('s3://');

  if (!srcIsS3 && !dstIsS3) {
    throw new Error('at least one of src or dst must be an s3:// URI');
  }
  if (srcIsS3 && dstIsS3) {
    throw new Error('at least one of src or dst must be a local path');
  }

  if (dstIsS3) {
    const finalUri = await upload(src, dst);
    console.log(`Uploaded: ${src} -> ${finalUri}`);
  } else {
    const finalPath = await download(src, dst);
    console.log(`Downloaded: ${src} -> ${finalPath}`);
  }
}

// Returns the final s3:// URI the object was written to.
async function upload(localPath, s3Uri) {
  const { bucket, key } = parseS3Uri(s3Uri);
  // If the destination is a bucket root or a prefix ending in '/', keep the source basename.
  const destKey = (!key || key.endsWith('/')) ? key + path.basename(localPath) : key;
  const label = path.basename(localPath);
  const total = fs.statSync(localPath).size;
  const bar = createProgressBar(label, total);

  const upload = new Upload({
    client,
    params: { Bucket: bucket, Key: destKey, Body: fs.createReadStream(localPath) },
  });

  upload.on('httpUploadProgress', (progress) => bar.update(progress.loaded));
  await upload.done();
  bar.stop();
  return `s3://${bucket}/${destKey}`;
}

// Returns the final local path the object was written to.
async function download(s3Uri, localPath) {
  const { bucket, key } = parseS3Uri(s3Uri);
  // If the destination is an existing directory or ends with a path separator, keep the object basename.
  const endsWithSep = /[\\/]$/.test(localPath);
  const isDir = fs.existsSync(localPath) && fs.statSync(localPath).isDirectory();
  const destPath = (endsWithSep || isDir) ? path.join(localPath, path.basename(key)) : localPath;
  const label = path.basename(destPath);

  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const total = head.ContentLength;
  const bar = createProgressBar(label, total);

  const resp = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

  let received = 0;
  const tracker = new Transform({
    transform(chunk, _enc, cb) {
      received += chunk.length;
      bar.update(received);
      cb(null, chunk);
    },
  });

  try {
    await pipeline(resp.Body, tracker, fs.createWriteStream(destPath));
  } catch (err) {
    bar.stop();
    try { fs.unlinkSync(destPath); } catch (_) {}
    throw err;
  }
  bar.stop();
  return destPath;
}

module.exports = cp;
module.exports.upload = upload;
module.exports.download = download;
