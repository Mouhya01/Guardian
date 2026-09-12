import type { NextFunction, Request, Response } from 'express';
import type { Options } from 'express-rate-limit';

/**
 * Shapes a 429 body the same way as GlobalExceptionFilter. express-rate-limit
 * short-circuits the request at the Express layer, before Nest's exception
 * filters run, so this has to be applied explicitly on each limiter.
 * `Retry-After` itself is set automatically by express-rate-limit whenever
 * `standardHeaders` is enabled — no extra work needed for that header.
 */
export function createRateLimitHandler() {
  return (req: Request, res: Response, _next: NextFunction, options: Options): void => {
    const message = typeof options.message === 'string' ? options.message : (options.message as { message?: string })?.message;

    res.status(options.statusCode).json({
      statusCode: options.statusCode,
      error: 'Too Many Requests',
      message: message ?? 'Rate limit exceeded. Please try again later.',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
  };
}
