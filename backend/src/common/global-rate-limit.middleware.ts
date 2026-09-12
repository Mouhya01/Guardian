import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppConfigService } from '../config/app-config.service.js';
import { createRateLimitHandler } from './rate-limit-response.util.js';

/** Baseline limiter applied to every route; /audit additionally gets its own, stricter limiter. */
@Injectable()
export class GlobalRateLimitMiddleware implements NestMiddleware {
  private readonly limiter: ReturnType<typeof rateLimit>;

  constructor(appConfig: AppConfigService) {
    this.limiter = rateLimit({
      windowMs: appConfig.globalRateLimitWindowMs,
      limit: appConfig.globalRateLimitMaxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Too many requests. Please try again later.',
      handler: createRateLimitHandler(),
    });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.limiter(req, res, next);
  }
}
