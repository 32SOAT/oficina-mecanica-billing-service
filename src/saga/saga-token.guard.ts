import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class SagaTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();
    const token = request.headers['x-saga-token'];
    const expected = process.env.SAGA_TOKEN ?? 'oficina-local';
    if (token !== expected) {
      throw new UnauthorizedException('Token do Saga ausente ou inválido');
    }
    return true;
  }
}
