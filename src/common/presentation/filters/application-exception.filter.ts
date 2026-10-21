import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

type HttpErrorPayload = {
  statusCode: number;
  message: string | string[];
  error?: string;
};

function resolveNestHttpException(exception: HttpException): HttpErrorPayload {
  const statusCode = exception.getStatus();
  const body = exception.getResponse();

  if (typeof body === 'string') {
    return { statusCode, message: body };
  }

  if (typeof body === 'object' && body !== null) {
    const payload = body as Record<string, unknown>;
    return {
      statusCode,
      message: (payload.message as string | string[]) ?? exception.message,
      error: payload.error as string | undefined,
    };
  }

  return { statusCode, message: exception.message };
}

@Catch()
export class ApplicationExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const resolved =
      exception instanceof HttpException
        ? resolveNestHttpException(exception)
        : null;

    if (resolved) {
      response.status(resolved.statusCode).json({
        statusCode: resolved.statusCode,
        ...(resolved.error ? { error: resolved.error } : {}),
        message: resolved.message,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
