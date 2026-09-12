import { BadRequestException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from './global-exception.filter.js';

function makeHost(url = '/audit'): { host: ArgumentsHost; res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } } {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ url, method: 'POST' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('GlobalExceptionFilter', () => {
  it('preserves the status and message of an HttpException', () => {
    const filter = new GlobalExceptionFilter();
    const { host, res } = makeHost('/audit');

    filter.catch(new BadRequestException('At least one file must be uploaded.'), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'At least one file must be uploaded.',
        path: '/audit',
      }),
    );
  });

  it('preserves an array message (e.g. from ValidationPipe)', () => {
    const filter = new GlobalExceptionFilter();
    const { host, res } = makeHost();

    filter.catch(new BadRequestException(['field a is required', 'field b must be a string']), host);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: ['field a is required', 'field b must be a string'] }),
    );
  });

  it('maps an unknown error to a generic 500 without leaking its details', () => {
    const filter = new GlobalExceptionFilter();
    const { host, res } = makeHost();
    const secretError = new Error('ENOENT: no such file or directory, open "C:/secret/db-password.txt"');

    filter.catch(secretError, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const [body] = res.json.mock.calls[0];
    expect(body.message).not.toContain('db-password');
    expect(body.message).not.toContain('ENOENT');
    expect(body).toMatchObject({ statusCode: 500, error: 'Internal Server Error' });
  });

  it('every response includes an ISO timestamp', () => {
    const filter = new GlobalExceptionFilter();
    const { host, res } = makeHost();

    filter.catch(new BadRequestException('bad'), host);

    const [body] = res.json.mock.calls[0];
    expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
  });
});
