import { UnauthorizedException } from '@nestjs/common';
import { SagaTokenGuard } from './saga-token.guard';

describe('SagaTokenGuard', () => {
  const guard = new SagaTokenGuard();

  function context(token?: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-saga-token': token } }),
      }),
    } as never;
  }

  it('accepts the local saga token', () => {
    expect(guard.canActivate(context('oficina-local'))).toBe(true);
  });

  it('rejects a missing token', () => {
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
  });
});
