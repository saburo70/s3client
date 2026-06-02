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
