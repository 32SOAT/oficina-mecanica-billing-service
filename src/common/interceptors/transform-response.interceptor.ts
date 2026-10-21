import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

type ResponseWithMeta = {
  data: unknown;
  meta: unknown;
};

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  private hasDataAndMeta(response: unknown): response is ResponseWithMeta {
    return (
      typeof response === 'object' &&
      response !== null &&
      'data' in response &&
      'meta' in response
    );
  }

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((response: unknown) => {
        if (!response) {
          return { data: [] };
        }
        if (this.hasDataAndMeta(response)) {
          return {
            data: response.data,
            meta: response.meta,
          };
        }
        return { data: response };
      }),
    );
  }
}
