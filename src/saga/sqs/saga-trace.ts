import { Message } from '@aws-sdk/client-sqs';
import tracer from 'dd-trace';

/** dd-trace links only the receive call; this span carries the handling too. */
export function traceSagaMessage<T>(
  name: string,
  message: Message,
  handler: () => Promise<T>,
): Promise<T> {
  return tracer.trace(name, { childOf: senderContext(message) }, handler);
}

function senderContext(message: Message) {
  try {
    return tracer.extract(
      'text_map',
      JSON.parse(message.MessageAttributes?._datadog?.StringValue ?? '{}'),
    );
  } catch {
    return null;
  }
}
