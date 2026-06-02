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
    await upload(src, dst);
  } else {
    await download(src, dst);
  }
}

async function upload(localPath, s3Uri) {
  const { bucket, key } = parseS3Uri(s3Uri);
  const label = path.basename(localPath);
  const total = fs.statSync(localPath).size;
  const bar = createProgressBar(label, total);

  const upload = new Upload({
    client,
    params: { Bucket: bucket, Key: key, Body: fs.createReadStream(localPath) },
  });

  upload.on('httpUploadProgress', (progress) => bar.update(progress.loaded));
  await upload.done();
  bar.stop();
  console.log(`Uploaded: ${localPath} -> ${s3Uri}`);
}

async function download(s3Uri, localPath) {
  const { bucket, key } = parseS3Uri(s3Uri);
  const label = path.basename(key);

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

  await pipeline(resp.Body, tracker, fs.createWriteStream(localPath));
  bar.stop();
  console.log(`Downloaded: ${s3Uri} -> ${localPath}`);
}

module.exports = cp;
