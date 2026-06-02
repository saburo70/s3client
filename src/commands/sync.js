const fs = require('fs');
const path = require('path');
const { ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const client = require('../client');
const { parseS3Uri } = require('../utils');
const cp = require('./cp');

function listLocalFiles(dir, base) {
  base = base || dir;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listLocalFiles(fullPath, base));
    } else {
      const stat = fs.statSync(fullPath);
      files.push({ key: path.relative(base, fullPath).replace(/\\/g, '/'), size: stat.size, fullPath });
    }
  }
  return files;
}

async function listS3Objects(bucket, prefix) {
  const objects = [];
  let ContinuationToken;
  do {
    const resp = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || undefined,
      ContinuationToken,
    }));
    objects.push(...(resp.Contents || []));
    ContinuationToken = resp.NextContinuationToken;
  } while (ContinuationToken);
  return objects;
}

function diffForUpload(localFiles, s3Objects, prefix) {
  const s3Map = new Map(s3Objects.map(o => [o.Key, o.Size]));
  return localFiles.filter(f => {
    const s3Key = prefix + f.key;
    return !s3Map.has(s3Key) || s3Map.get(s3Key) !== f.size;
  });
}

function diffForDownload(s3Objects, localFiles, prefix) {
  const localMap = new Map(localFiles.map(f => [f.key, f.size]));
  return s3Objects.filter(o => {
    const localKey = o.Key.slice(prefix.length);
    return !localMap.has(localKey) || localMap.get(localKey) !== o.Size;
  });
}

async function sync(src, dst, opts) {
  const srcIsS3 = src.startsWith('s3://');
  const dstIsS3 = dst.startsWith('s3://');

  if (srcIsS3 && dstIsS3) throw new Error('sync requires at least one local path');
  if (!srcIsS3 && !dstIsS3) throw new Error('sync requires at least one s3:// URI');

  if (!srcIsS3 && dstIsS3) {
    await syncUpload(src, dst, opts.delete);
  } else {
    await syncDownload(src, dst, opts.delete);
  }
}

async function syncUpload(localDir, s3Uri, shouldDelete) {
  const { bucket, key: prefix } = parseS3Uri(s3Uri);
  const normalizedPrefix = prefix && !prefix.endsWith('/') ? prefix + '/' : prefix;

  const localFiles = listLocalFiles(localDir);
  const s3Objects = await listS3Objects(bucket, normalizedPrefix);
  const toUpload = diffForUpload(localFiles, s3Objects, normalizedPrefix);

  for (const file of toUpload) {
    const dstUri = `s3://${bucket}/${normalizedPrefix}${file.key}`;
    console.log(`upload: ${file.fullPath} -> ${dstUri}`);
    await cp(file.fullPath, dstUri);
  }

  if (shouldDelete) {
    const localKeys = new Set(localFiles.map(f => normalizedPrefix + f.key));
    const toDelete = s3Objects.filter(o => !localKeys.has(o.Key));
    for (const obj of toDelete) {
      console.log(`delete: s3://${bucket}/${obj.Key}`);
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
    }
  }

  console.log(`Synced ${toUpload.length} file(s).`);
}

async function syncDownload(s3Uri, localDir, shouldDelete) {
  const { bucket, key: prefix } = parseS3Uri(s3Uri);
  const normalizedPrefix = prefix && !prefix.endsWith('/') ? prefix + '/' : prefix;

  const s3Objects = await listS3Objects(bucket, normalizedPrefix);
  const localFiles = fs.existsSync(localDir) ? listLocalFiles(localDir) : [];
  const toDownload = diffForDownload(s3Objects, localFiles, normalizedPrefix);

  for (const obj of toDownload) {
    const relKey = obj.Key.slice(normalizedPrefix.length);
    const localPath = path.join(localDir, relKey);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    console.log(`download: s3://${bucket}/${obj.Key} -> ${localPath}`);
    await cp(`s3://${bucket}/${obj.Key}`, localPath);
  }

  if (shouldDelete) {
    const s3Keys = new Set(s3Objects.map(o => o.Key.slice(normalizedPrefix.length)));
    const toDelete = localFiles.filter(f => !s3Keys.has(f.key));
    for (const file of toDelete) {
      console.log(`delete: ${file.fullPath}`);
      fs.unlinkSync(file.fullPath);
    }
  }

  console.log(`Synced ${toDownload.length} object(s).`);
}

module.exports = sync;
module.exports.diffForUpload = diffForUpload;
module.exports.diffForDownload = diffForDownload;
