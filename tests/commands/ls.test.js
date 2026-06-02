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
