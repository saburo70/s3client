const { CreateBucketCommand } = require('@aws-sdk/client-s3');
const client = require('../client');
const { parseS3Uri } = require('../utils');

async function mb(target) {
  const { bucket } = parseS3Uri(target);
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  console.log(`Created bucket: ${bucket}`);
}

module.exports = mb;
