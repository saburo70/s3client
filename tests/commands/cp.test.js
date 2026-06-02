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
jest.mock('stream/promises', () => ({ pipeline: jest.fn().mockResolvedValue(undefined) }));

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
