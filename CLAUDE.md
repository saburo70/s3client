# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Node.js CLI tool for interacting with an OVH-hosted S3-compatible object storage service, similar in spirit to the AWS CLI. Uses the AWS SDK v3 (`@aws-sdk/client-s3`) since OVH S3 is API-compatible.

## Stack

- **Runtime:** Node.js (plain JavaScript, no TypeScript)
- **S3 Client:** `@aws-sdk/client-s3` — configured with a custom endpoint for OVH
- **CLI parsing:** `commander` or similar (no frameworks)
- **No React, no jQuery**

## Configuration

Credentials and endpoint are loaded from environment variables or a local `.env` file (never hardcoded):

```
S3_ENDPOINT=https://s3.eu-south-mil.io.cloud.ovh.net/
S3_ACCESS_KEY=<your access key>
S3_SECRET_KEY=<your secret key>
S3_REGION=eu-south-mil
```

The S3 client must be initialized with `forcePathStyle: true` for OVH compatibility.

## Commands

```bash
npm install          # install dependencies
node index.js --help # show available commands
node index.js ls [bucket] [prefix]
node index.js cp <src> <dst>
node index.js rm <s3-path>
node index.js mb <bucket>
node index.js rb <bucket>
```

## Architecture

- `index.js` — CLI entry point, command registration via `commander`
- `src/client.js` — creates and exports the configured `S3Client` singleton (reads env vars)
- `src/commands/` — one file per command (`ls.js`, `cp.js`, `rm.js`, `mb.js`, `rb.js`)
- Each command module exports an `async function` that receives parsed CLI args and calls the S3 SDK
- `src/utils.js` — shared helpers (S3 URI parsing `s3://bucket/key`, progress display, etc.)

S3 URIs follow the `s3://bucket/key` convention. Parsing is centralised in `utils.js`.
