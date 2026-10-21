import { of } from 'rxjs';
import { TransformResponseInterceptor } from './transform-response.interceptor';

describe('TransformResponseInterceptor', () => {
  const interceptor = new TransformResponseInterceptor();

  function handle(response: unknown) {
    return interceptor.intercept({} as never, {
      handle: () => of(response),
    });
  }

  it('wraps a payload in data', (done) => {
    handle({ status: 'ok' }).subscribe((body) => {
      expect(body).toEqual({ data: { status: 'ok' } });
      done();
    });
  });

  it('returns an empty list when the handler has no body', (done) => {
    handle(null).subscribe((body) => {
      expect(body).toEqual({ data: [] });
      done();
    });
  });

  it('preserves data and meta', (done) => {
    handle({ data: [{ id: '1' }], meta: { page: 1 } }).subscribe((body) => {
      expect(body).toEqual({ data: [{ id: '1' }], meta: { page: 1 } });
      done();
    });
  });
});
