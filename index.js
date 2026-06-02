#!/usr/bin/env node
process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.name !== 'ExperimentalWarning') process.stderr.write(`${w.name}: ${w.message}\n`);
});
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
    const msg = err.Code || err.code || err.name || 'Error';
    console.error(`${msg}: ${err.message}`);
  }
  process.exit(1);
});
