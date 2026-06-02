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
