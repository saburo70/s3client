# S3 CLI Client — Design Spec

**Date:** 2026-06-02  
**Status:** Approved

## Overview

A Node.js CLI tool for interacting with an OVH-hosted S3-compatible object storage service. Installable globally (`npm install -g`) and also runnable locally (`node index.js`). Modelled after the AWS CLI's S3 subcommands.

## Target Service

- **Endpoint:** `https://s3.eu-south-mil.io.cloud.ovh.net/`
- **Region:** `eu-south-mil`
- **Protocol:** S3-compatible API — requires `forcePathStyle: true`
- **Credentials:** loaded from environment variables, never hardcoded

## Commands

| Command | Syntax | Behaviour |
|---|---|---|
| `ls` | `s3 ls` | List all buckets |
| `ls` | `s3 ls s3://bucket[/prefix]` | List objects in bucket, optionally filtered by prefix |
| `cp` | `s3 cp <src> <dst>` | Upload (local→S3) or download (S3→local); direction detected from args |
| `rm` | `s3 rm s3://bucket/key` | Delete a single object |
| `mb` | `s3 mb s3://bucket` | Create a bucket |
| `rb` | `s3 rb s3://bucket` | Remove a bucket (must be empty) |
| `sync` | `s3 sync <src> <dst>` | Sync local dir ↔ S3 prefix; optional `--delete` flag |

`sync` diffs by key + size only (no timestamps). `--delete` removes destination entries not present in source.

## Project Structure

```
s3/
├── index.js                    # shebang, commander setup, top-level error handler
├── src/
│   ├── client.js               # S3Client singleton (reads env, sets forcePathStyle)
│   ├── utils.js                # parseS3Uri(), formatBytes(), createProgressBar()
│   └── commands/
│       ├── ls.js
│       ├── cp.js
│       ├── rm.js
│       ├── mb.js
│       ├── rb.js
│       └── sync.js
├── .env                        # gitignored
├── .env.example                # committed, documents required vars
└── package.json                # bin: { "s3": "./index.js" }
```

Each command module exports a single `async function(args, options)`. `index.js` wires commander args to these functions and does nothing else.

## Dependencies

| Package | Purpose |
|---|---|
| `@aws-sdk/client-s3` | Core S3 operations |
| `@aws-sdk/lib-storage` | Multipart upload (auto-splits files > 5MB) |
| `commander` | CLI arg parsing |
| `cli-progress` | Progress bars for cp and sync |
| `dotenv` | Load `.env` at startup |

## Configuration

```
S3_ENDPOINT=https://s3.eu-south-mil.io.cloud.ovh.net/
S3_ACCESS_KEY=<access key>
S3_SECRET_KEY=<secret key>
S3_REGION=eu-south-mil
```

`src/client.js` is the only place that reads these vars. All commands import the singleton client.

## Progress Display

`cp` and `sync` show a `cli-progress` bar:

```
filename.zip [=========>    ] 62%  14.2MB/22.9MB
```

- **Upload:** file size from `fs.stat` before transfer
- **Download:** file size from `ContentLength` response header
- `@aws-sdk/lib-storage` handles multipart automatically for large files

## Error Handling

- AWS SDK errors expose `name` (e.g. `NoSuchBucket`, `NoSuchKey`) and `$metadata.httpStatusCode`
- Top-level handler in `index.js` catches all errors, prints a clean one-line message, exits with code 1
- `--debug` flag skips the clean handler and prints the full stack trace
