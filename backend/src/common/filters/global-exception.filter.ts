import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

/**
 * Catches everything (HttpExceptions and raw errors alike) and normalizes the
 * response shape. Unexpected (non-HttpException) errors are logged in full
 * server-side but only ever surface a generic message to the client — no
 * stack traces or internal details leak into the HTTP response.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.buildResponseBody(exception, request.url);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const details = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`Unhandled exception on ${request.method} ${request.url}: ${details}`);
    }

    response.status(body.statusCode).json(body);
  }

  private buildResponseBody(exception: unknown, path: string): ErrorResponseBody {
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'object' && payload !== null && 'message' in payload) {
        const { message, error } = payload as { message: string | string[]; error?: string };
        return { statusCode: status, error: error ?? STATUS_CODES[status] ?? 'Error', message, timestamp, path };
      }

      return {
        statusCode: status,
        error: STATUS_CODES[status] ?? 'Error',
        message: typeof payload === 'string' ? payload : exception.message,
        timestamp,
        path,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
      timestamp,
      path,
    };
  }
}
