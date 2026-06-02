const mockSend = jest.fn();
jest.mock('../../src/client', () => ({ send: mockSend }));
const mb = require('../../src/commands/mb');

beforeEach(() => mockSend.mockReset());

test('creates bucket from s3:// URI', async () => {
  mockSend.mockResolvedValue({});
  await mb('s3://new-bucket');
  const call = mockSend.mock.calls[0][0];
  expect(call.input.Bucket).toBe('new-bucket');
});
