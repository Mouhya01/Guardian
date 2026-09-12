import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppConfigService } from '../config/app-config.service.js';

/** Stricter limiter dedicated to /audit — each request triggers a paid, rate-limited Gemini call. */
@Injectable()
export class AuditRateLimitMiddleware implements NestMiddleware {
  private readonly limiter: ReturnType<typeof rateLimit>;

  constructor(appConfig: AppConfigService) {
    this.limiter = rateLimit({
      windowMs: appConfig.auditRateLimitWindowMs,
      limit: appConfig.auditRateLimitMaxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        message: 'Too many audit requests. This endpoint is limited to protect the Gemini API quota — please retry later.',
      },
    });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.limiter(req, res, next);
  }
}
