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
