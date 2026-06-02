const { ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const client = require('../client');
const { parseS3Uri } = require('../utils');

async function ls(target) {
  if (!target) {
    const resp = await client.send(new ListBucketsCommand({}));
    for (const b of resp.Buckets) console.log(b.Name);
    return;
  }

  const { bucket, key } = parseS3Uri(target);
  let ContinuationToken;
  do {
    const resp = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: key || undefined,
      ContinuationToken,
    }));
    for (const obj of (resp.Contents || [])) {
      console.log(`${obj.LastModified.toISOString()}  ${String(obj.Size).padStart(10)}  ${obj.Key}`);
    }
    ContinuationToken = resp.NextContinuationToken;
  } while (ContinuationToken);
}

module.exports = ls;
