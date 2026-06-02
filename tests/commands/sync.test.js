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
