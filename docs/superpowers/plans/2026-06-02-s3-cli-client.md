# S3 CLI Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js CLI for OVH S3-compatible storage with ls, cp, rm, mb, rb, and sync commands, plus upload/download progress bars.

**Architecture:** Commander-based entry point (`index.js`) registers one command per module in `src/commands/`. A shared `S3Client` singleton in `src/client.js` reads credentials from env vars and is imported by every command. Transfers stream data and update a `cli-progress` bar. `@aws-sdk/lib-storage` handles multipart uploads (>5MB) transparently.

**Tech Stack:** Node.js (plain JS), `@aws-sdk/client-s3` v3, `@aws-sdk/lib-storage`, `commander`, `cli-progress`, `dotenv`, `jest`

---

## File Map

| File | Responsibility |
|---|---|
| `index.js` | Shebang, commander setup, global error handler, `--debug` flag |
| `src/client.js` | `S3Client` singleton — reads env vars, sets `forcePathStyle: true` |
| `src/utils.js` | `parseS3Uri(uri)`, `formatBytes(n)`, `createProgressBar(label, total)` |
| `src/commands/ls.js` | List all buckets or objects under a prefix |
| `src/commands/cp.js` | Upload (local→S3) or download (S3→local) with progress |
| `src/commands/rm.js` | Delete a single S3 object |
| `src/commands/mb.js` | Create a bucket |
| `src/commands/rb.js` | Remove an empty bucket |
| `src/commands/sync.js` | Sync local dir ↔ S3 prefix; `--delete` flag |
| `tests/utils.test.js` | Unit tests for `parseS3Uri`, `formatBytes` |
| `tests/commands/ls.test.js` | Tests for ls with mocked client |
| `tests/commands/cp.test.js` | Tests for cp direction detection and calls |
| `tests/commands/rm.test.js` | Tests for rm |
| `tests/commands/mb.test.js` | Tests for mb |
| `tests/commands/rb.test.js` | Tests for rb |
| `tests/commands/sync.test.js` | Tests for sync diff logic and --delete |

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Initialize npm and install dependencies**

```bash
cd D:/coding/s3
npm init -y
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage commander cli-progress dotenv
npm install --save-dev jest
```

- [ ] **Step 2: Edit `package.json` — add `bin`, `engines`, test script, and Jest config**

Open `package.json` and add/replace these fields (keep the `dependencies`/`devDependencies` npm filled in):

```json
{
  "name": "s3-cli",
  "version": "1.0.0",
  "description": "S3 CLI client for OVH-compatible storage",
  "main": "index.js",
  "bin": {
    "s3": "./index.js"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "engines": {
    "node": ">=15.0.0"
  },
  "jest": {
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
.env
```

- [ ] **Step 4: Create `.env.example`**

```
S3_ENDPOINT=https://s3.eu-south-mil.io.cloud.ovh.net/
S3_ACCESS_KEY=your_access_key_here
S3_SECRET_KEY=your_secret_key_here
S3_REGION=eu-south-mil
```

- [ ] **Step 5: Create `.env` with real credentials (not committed)**

```
S3_ENDPOINT=https://s3.eu-south-mil.io.cloud.ovh.net/
S3_ACCESS_KEY=c58386f1dcf645d594eb7e3318537be5
S3_SECRET_KEY=1eeb3426cf6a4904afc3abd5eabcefff
S3_REGION=eu-south-mil
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example
git commit -m "chore: scaffold project with dependencies"
```

---

### Task 2: Utils Module

**Files:**
- Create: `src/utils.js`
- Create: `tests/utils.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/utils.test.js`:

```javascript
const { parseS3Uri, formatBytes } = require('../src/utils');

describe('parseS3Uri', () => {
  test('parses bucket and key', () => {
    expect(parseS3Uri('s3://my-bucket/path/to/file.txt'))
      .toEqual({ bucket: 'my-bucket', key: 'path/to/file.txt' });
  });

  test('parses bucket only (no slash)', () => {
    expect(parseS3Uri('s3://my-bucket'))
      .toEqual({ bucket: 'my-bucket', key: '' });
  });

  test('parses bucket with trailing slash', () => {
    expect(parseS3Uri('s3://my-bucket/'))
      .toEqual({ bucket: 'my-bucket', key: '' });
  });

  test('parses prefix with trailing slash', () => {
    expect(parseS3Uri('s3://my-bucket/folder/'))
      .toEqual({ bucket: 'my-bucket', key: 'folder/' });
  });

  test('throws on invalid URI', () => {
    expect(() => parseS3Uri('not-an-s3-uri')).toThrow('Invalid S3 URI: not-an-s3-uri');
  });
});

describe('formatBytes', () => {
  test('formats bytes', () => expect(formatBytes(512)).toBe('512B'));
  test('formats kilobytes', () => expect(formatBytes(1536)).toBe('1.5KB'));
  test('formats megabytes', () => expect(formatBytes(1572864)).toBe('1.5MB'));
  test('formats gigabytes', () => expect(formatBytes(1610612736)).toBe('1.5GB'));
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/utils.test.js
```

Expected: `Cannot find module '../src/utils'`

- [ ] **Step 3: Implement `src/utils.js`**

```javascript
const { SingleBar, Presets } = require('cli-progress');

function parseS3Uri(uri) {
  const match = uri.match(/^s3:\/\/([^/]+)\/?(.*)$/);
  if (!match) throw new Error(`Invalid S3 URI: ${uri}`);
  return { bucket: match[1], key: match[2] };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

function createProgressBar(label, total) {
  const bar = new SingleBar({
    format: `${label} [{bar}] {percentage}%  {value}/{total}`,
    formatValue: (v, _, type) => (type === 'value' || type === 'total') ? formatBytes(v) : v,
  }, Presets.shades_classic);
  bar.start(total, 0);
  return bar;
}

module.exports = { parseS3Uri, formatBytes, createProgressBar };
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest tests/utils.test.js
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils.js tests/utils.test.js
git commit -m "feat: add utils module (parseS3Uri, formatBytes, createProgressBar)"
```

---

### Task 3: S3 Client Singleton

**Files:**
- Create: `src/client.js`

- [ ] **Step 1: Create `src/client.js`**

```javascript
require('dotenv').config();
const { S3Client } = require('@aws-sdk/client-s3');

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
```

- [ ] **Step 2: Commit**

```bash
git add src/client.js
git commit -m "feat: add S3Client singleton"
```

---

### Task 4: Entry Point

**Files:**
- Create: `index.js`

- [ ] **Step 1: Create `index.js`**

```javascript
#!/usr/bin/env node
const { Command } = require('commander');

const program = new Command();

program
  .name('s3')
  .description('S3 CLI client for OVH-compatible storage')
  .version('1.0.0')
  .option('--debug', 'show full error stack traces');

program
  .command('ls [target]')
  .description('List buckets, or objects in s3://bucket[/prefix]')
  .action(async (target) => {
    const ls = require('./src/commands/ls');
    await ls(target);
  });

program
  .command('cp <src> <dst>')
  .description('Upload (local -> s3://) or download (s3:// -> local)')
  .action(async (src, dst) => {
    const cp = require('./src/commands/cp');
    await cp(src, dst);
  });

program
  .command('rm <target>')
  .description('Delete s3://bucket/key')
  .action(async (target) => {
    const rm = require('./src/commands/rm');
    await rm(target);
  });

program
  .command('mb <target>')
  .description('Create s3://bucket')
  .action(async (target) => {
    const mb = require('./src/commands/mb');
    await mb(target);
  });

program
  .command('rb <target>')
  .description('Remove s3://bucket (must be empty)')
  .action(async (target) => {
    const rb = require('./src/commands/rb');
    await rb(target);
  });

program
  .command('sync <src> <dst>')
  .description('Sync local dir <-> s3://bucket/prefix')
  .option('--delete', 'remove destination entries not in source')
  .action(async (src, dst, opts) => {
    const sync = require('./src/commands/sync');
    await sync(src, dst, opts);
  });

program.parseAsync(process.argv).catch((err) => {
  if (program.opts().debug) {
    console.error(err);
  } else {
    const msg = err.Code || err.name || 'Error';
    console.error(`${msg}: ${err.message}`);
  }
  process.exit(1);
});
```

- [ ] **Step 2: Make it executable**

```bash
node index.js --help
```

Expected: usage text listing all 6 commands.

- [ ] **Step 3: Commit**

```bash
git add index.js
git commit -m "feat: add entry point with commander setup and error handler"
```

---

### Task 5: ls Command

**Files:**
- Create: `src/commands/ls.js`
- Create: `tests/commands/ls.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/commands/ls.test.js`:

```javascript
const mockSend = jest.fn();
jest.mock('../../src/client', () => ({ send: mockSend }));

const ls = require('../../src/commands/ls');

beforeEach(() => {
  mockSend.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => console.log.mockRestore());

test('lists bucket names when called with no target', async () => {
  mockSend.mockResolvedValue({ Buckets: [{ Name: 'alpha' }, { Name: 'beta' }] });
  await ls(undefined);
  expect(console.log).toHaveBeenCalledWith('alpha');
  expect(console.log).toHaveBeenCalledWith('beta');
});

test('lists objects when called with s3://bucket', async () => {
  mockSend.mockResolvedValue({
    Contents: [{ Key: 'a/b.txt', Size: 1024, LastModified: new Date('2024-01-01') }],
    NextContinuationToken: undefined,
  });
  await ls('s3://my-bucket');
  expect(console.log).toHaveBeenCalledWith(
    expect.stringContaining('a/b.txt')
  );
});

test('lists objects under prefix when called with s3://bucket/prefix/', async () => {
  mockSend.mockResolvedValue({ Contents: [], NextContinuationToken: undefined });
  await ls('s3://my-bucket/folder/');
  const call = mockSend.mock.calls[0][0];
  expect(call.input.Prefix).toBe('folder/');
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/commands/ls.test.js
```

Expected: `Cannot find module '../../src/commands/ls'`

- [ ] **Step 3: Implement `src/commands/ls.js`**

```javascript
const { ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const client = require('../client');
const { parseS3Uri, formatBytes } = require('../utils');

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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest tests/commands/ls.test.js
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Smoke test against real service**

```bash
node index.js ls
```

Expected: your OVH bucket names printed, one per line.

- [ ] **Step 6: Commit**

```bash
git add src/commands/ls.js tests/commands/ls.test.js
git commit -m "feat: add ls command"
```

---

### Task 6: mb, rb, rm Commands

**Files:**
- Create: `src/commands/mb.js`
- Create: `src/commands/rb.js`
- Create: `src/commands/rm.js`
- Create: `tests/commands/mb.test.js`
- Create: `tests/commands/rb.test.js`
- Create: `tests/commands/rm.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/commands/mb.test.js`:

```javascript
const mockSend = jest.fn();
jest.mock('../../src/client', () => ({ send: mockSend }));
const mb = require('../../src/commands/mb');

beforeEach(() => mockSend.mockReset());

test('creates bucket from s3:// URI', async () => {
  mockSend.mockResolvedValue({});
  await mb('s3://new-bucket');
  const call = mockSend.mock.calls[0][0];
  expect(call.input.Bucket).toBe('new-bucket');
});
```

Create `tests/commands/rb.test.js`:

```javascript
const mockSend = jest.fn();
jest.mock('../../src/client', () => ({ send: mockSend }));
const rb = require('../../src/commands/rb');

beforeEach(() => mockSend.mockReset());

test('deletes bucket from s3:// URI', async () => {
  mockSend.mockResolvedValue({});
  await rb('s3://old-bucket');
  const call = mockSend.mock.calls[0][0];
  expect(call.input.Bucket).toBe('old-bucket');
});
```

Create `tests/commands/rm.test.js`:

```javascript
const mockSend = jest.fn();
jest.mock('../../src/client', () => ({ send: mockSend }));
const rm = require('../../src/commands/rm');

beforeEach(() => mockSend.mockReset());

test('deletes object from s3://bucket/key', async () => {
  mockSend.mockResolvedValue({});
  await rm('s3://my-bucket/path/to/file.txt');
  const call = mockSend.mock.calls[0][0];
  expect(call.input.Bucket).toBe('my-bucket');
  expect(call.input.Key).toBe('path/to/file.txt');
});

test('throws on URI with no key', async () => {
  await expect(rm('s3://my-bucket')).rejects.toThrow('rm requires a full object key');
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/commands/mb.test.js tests/commands/rb.test.js tests/commands/rm.test.js
```

Expected: `Cannot find module` errors for all three.

- [ ] **Step 3: Implement `src/commands/mb.js`**

```javascript
const { CreateBucketCommand } = require('@aws-sdk/client-s3');
const client = require('../client');
const { parseS3Uri } = require('../utils');

async function mb(target) {
  const { bucket } = parseS3Uri(target);
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  console.log(`Created bucket: ${bucket}`);
}

module.exports = mb;
```

- [ ] **Step 4: Implement `src/commands/rb.js`**

```javascript
const { DeleteBucketCommand } = require('@aws-sdk/client-s3');
const client = require('../client');
const { parseS3Uri } = require('../utils');

async function rb(target) {
  const { bucket } = parseS3Uri(target);
  await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  console.log(`Removed bucket: ${bucket}`);
}

module.exports = rb;
```

- [ ] **Step 5: Implement `src/commands/rm.js`**

```javascript
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
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npx jest tests/commands/mb.test.js tests/commands/rb.test.js tests/commands/rm.test.js
```

Expected: all 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/commands/mb.js src/commands/rb.js src/commands/rm.js tests/commands/mb.test.js tests/commands/rb.test.js tests/commands/rm.test.js
git commit -m "feat: add mb, rb, rm commands"
```

---

### Task 7: cp Command (Upload + Download with Progress)

**Files:**
- Create: `src/commands/cp.js`
- Create: `tests/commands/cp.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/commands/cp.test.js`:

```javascript
const mockSend = jest.fn();
jest.mock('../../src/client', () => ({ send: mockSend }));
jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation(() => ({
    on: jest.fn().mockReturnThis(),
    done: jest.fn().mockResolvedValue({}),
  })),
}));
jest.mock('cli-progress', () => ({
  SingleBar: jest.fn().mockImplementation(() => ({
    start: jest.fn(), update: jest.fn(), stop: jest.fn(),
  })),
  Presets: { shades_classic: {} },
}));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  statSync: jest.fn().mockReturnValue({ size: 2048 }),
  createReadStream: jest.fn().mockReturnValue({ pipe: jest.fn() }),
  createWriteStream: jest.fn().mockReturnValue({}),
}));

const cp = require('../../src/commands/cp');
const { Upload } = require('@aws-sdk/lib-storage');

beforeEach(() => { mockSend.mockReset(); Upload.mockClear(); });

test('detects upload direction when dst is s3://', async () => {
  await cp('local/file.txt', 's3://my-bucket/remote/file.txt');
  expect(Upload).toHaveBeenCalledWith(expect.objectContaining({
    params: expect.objectContaining({ Bucket: 'my-bucket', Key: 'remote/file.txt' }),
  }));
});

test('detects download direction when src is s3://', async () => {
  mockSend
    .mockResolvedValueOnce({ ContentLength: 2048 })
    .mockResolvedValueOnce({ Body: { pipe: jest.fn(), on: jest.fn() } });
  await cp('s3://my-bucket/remote/file.txt', 'local/file.txt');
  expect(mockSend).toHaveBeenCalledTimes(2);
});

test('throws when both src and dst are local paths', async () => {
  await expect(cp('local/a.txt', 'local/b.txt'))
    .rejects.toThrow('at least one of src or dst must be an s3:// URI');
});

test('throws when both src and dst are s3:// URIs', async () => {
  await expect(cp('s3://b/a.txt', 's3://b/b.txt'))
    .rejects.toThrow('at least one of src or dst must be a local path');
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/commands/cp.test.js
```

Expected: `Cannot find module '../../src/commands/cp'`

- [ ] **Step 3: Implement `src/commands/cp.js`**

```javascript
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest tests/commands/cp.test.js
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Smoke test upload**

```bash
node index.js cp README.md s3://your-bucket/test/README.md
```

Expected: progress bar then `Uploaded: README.md -> s3://...`

- [ ] **Step 6: Smoke test download**

```bash
node index.js cp s3://your-bucket/test/README.md /tmp/README-downloaded.md
```

Expected: progress bar then `Downloaded: s3://... -> /tmp/README-downloaded.md`

- [ ] **Step 7: Commit**

```bash
git add src/commands/cp.js tests/commands/cp.test.js
git commit -m "feat: add cp command with upload/download progress"
```

---

### Task 8: sync Command

**Files:**
- Create: `src/commands/sync.js`
- Create: `tests/commands/sync.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/commands/sync.test.js`:

```javascript
const { diffForUpload, diffForDownload } = require('../../src/commands/sync');

describe('diffForUpload', () => {
  const localFiles = [
    { key: 'a.txt', size: 100, fullPath: '/dir/a.txt' },
    { key: 'b.txt', size: 200, fullPath: '/dir/b.txt' },
    { key: 'c.txt', size: 300, fullPath: '/dir/c.txt' },
  ];
  const s3Objects = [
    { Key: 'prefix/a.txt', Size: 100 },
    { Key: 'prefix/b.txt', Size: 999 },
  ];

  test('includes files missing from S3', () => {
    const result = diffForUpload(localFiles, s3Objects, 'prefix/');
    expect(result.map(f => f.key)).toContain('c.txt');
  });

  test('includes files with different size', () => {
    const result = diffForUpload(localFiles, s3Objects, 'prefix/');
    expect(result.map(f => f.key)).toContain('b.txt');
  });

  test('excludes files already in sync', () => {
    const result = diffForUpload(localFiles, s3Objects, 'prefix/');
    expect(result.map(f => f.key)).not.toContain('a.txt');
  });
});

describe('diffForDownload', () => {
  const s3Objects = [
    { Key: 'prefix/a.txt', Size: 100 },
    { Key: 'prefix/b.txt', Size: 200 },
    { Key: 'prefix/c.txt', Size: 300 },
  ];
  const localFiles = [
    { key: 'a.txt', size: 100, fullPath: '/dir/a.txt' },
    { key: 'b.txt', size: 999, fullPath: '/dir/b.txt' },
  ];

  test('includes objects missing locally', () => {
    const result = diffForDownload(s3Objects, localFiles, 'prefix/');
    expect(result.map(o => o.Key)).toContain('prefix/c.txt');
  });

  test('includes objects with different size', () => {
    const result = diffForDownload(s3Objects, localFiles, 'prefix/');
    expect(result.map(o => o.Key)).toContain('prefix/b.txt');
  });

  test('excludes objects already in sync', () => {
    const result = diffForDownload(s3Objects, localFiles, 'prefix/');
    expect(result.map(o => o.Key)).not.toContain('prefix/a.txt');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/commands/sync.test.js
```

Expected: `Cannot find module '../../src/commands/sync'`

- [ ] **Step 3: Implement `src/commands/sync.js`**

```javascript
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest tests/commands/sync.test.js
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx jest
```

Expected: all tests PASS.

- [ ] **Step 6: Smoke test sync upload**

Create a local folder with a couple of test files, then:

```bash
mkdir test-sync && echo "hello" > test-sync/a.txt && echo "world" > test-sync/b.txt
node index.js sync test-sync/ s3://your-bucket/test-sync/
```

Expected: progress bars for each file, then `Synced 2 file(s).`

Run again — expected: `Synced 0 file(s).` (no changes).

- [ ] **Step 7: Commit**

```bash
git add src/commands/sync.js tests/commands/sync.test.js
git commit -m "feat: add sync command with --delete flag"
```

---

### Task 9: Global Install Verification

- [ ] **Step 1: Install globally**

```bash
npm install -g .
```

- [ ] **Step 2: Verify global invocation**

```bash
s3 --help
s3 ls
```

Expected: help output and bucket list without `node index.js`.

- [ ] **Step 3: Commit final state**

```bash
git add -A
git status
# confirm nothing unexpected
git commit -m "chore: verify global install and finalize scaffold"
```
