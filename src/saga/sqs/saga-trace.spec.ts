import tracer from 'dd-trace';
import { traceSagaMessage } from './saga-trace';

jest.mock('dd-trace', () => ({
  __esModule: true,
  default: {
    extract: jest.fn(),
    trace: jest.fn((_name: string, _options: object, handler: () => unknown) =>
      handler(),
    ),
  },
}));

describe('traceSagaMessage', () => {
  const extract = jest.spyOn(tracer, 'extract');
  const trace = jest.spyOn(tracer, 'trace');
  const handler = jest.fn(() => Promise.resolve('done'));

  beforeEach(() => jest.clearAllMocks());

  it('continues the trace carried by the message', async () => {
    const carrier = { 'x-datadog-trace-id': '1', 'x-datadog-parent-id': '2' };
    const context = { carrier };
    extract.mockReturnValue(context as never);
    const message = {
      MessageAttributes: {
        _datadog: { DataType: 'String', StringValue: JSON.stringify(carrier) },
      },
    };

    await expect(
      traceSagaMessage('saga.command', message, handler),
    ).resolves.toBe('done');

    expect(extract).toHaveBeenCalledWith('text_map', carrier);
    expect(trace).toHaveBeenCalledWith(
      'saga.command',
      { childOf: context },
      handler,
    );
  });

  it.each([
    {},
    {
      MessageAttributes: { _datadog: { DataType: 'String', StringValue: '{' } },
    },
  ])('starts a new trace without a valid context', async (message) => {
    extract.mockReturnValue(null);

    await traceSagaMessage('saga.command', message, handler);

    expect(trace).toHaveBeenCalledWith(
      'saga.command',
      { childOf: null },
      handler,
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
