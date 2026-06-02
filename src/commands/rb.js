const { DeleteBucketCommand } = require('@aws-sdk/client-s3');
const client = require('../client');
const { parseS3Uri } = require('../utils');

async function rb(target) {
  const { bucket } = parseS3Uri(target);
  await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  console.log(`Removed bucket: ${bucket}`);
}

module.exports = rb;
