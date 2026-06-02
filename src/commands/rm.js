const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const client = require('../client');
const { parseS3Uri } = require('../utils');

async function rm(target) {
  const { bucket, key } = parseS3Uri(target);
  if (!key) throw new Error('rm requires a full object key, e.g. s3://bucket/path/to/file');
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log(`Deleted: ${target}`);
}

module.exports = rm;
