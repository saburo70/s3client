# S3 CLI Tool

A small Node.js CLI for interacting with an OVH-hosted S3-compatible object storage service.

## Project structure

- `index.js` — CLI entry point and command registration.
- `src/client.js` — creates and exports the configured S3 client singleton.
- `src/commands/` — command implementations for listing, copying, removing, creating, and deleting buckets.
- `src/utils.js` — shared helpers such as S3 URI parsing and progress formatting.
- `tests/` — unit tests for the utility and command modules.

## Configuration

Set the following environment variables (or place them in a local `.env` file):

```bash
S3_ENDPOINT=https://s3.eu-south-mil.io.cloud.ovh.net/
S3_ACCESS_KEY=<your access key>
S3_SECRET_KEY=<your secret key>
S3_REGION=eu-south-mil
```

The client is initialized with `forcePathStyle: true` for OVH compatibility.

## Basic usage

Install dependencies:

```bash
npm install
```

Show available commands:

```bash
node index.js --help
```

Examples:

```bash
node index.js ls
node index.js ls my-bucket
node index.js cp local-file.txt s3://my-bucket/path/local-file.txt
node index.js rm s3://my-bucket/path/file.txt
node index.js mb my-bucket
node index.js rb my-bucket
```

## How the client works

The CLI command modules call the shared S3 client from `src/client.js`. That keeps authentication, endpoint configuration, and AWS SDK setup in one place, while each command only focuses on its own logic.
