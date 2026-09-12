import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { GeminiModule } from '../gemini/gemini.module.js';
import { AuditRateLimitMiddleware } from './audit-rate-limit.middleware.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';

@Module({
  imports: [GeminiModule],
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuditRateLimitMiddleware).forRoutes(AuditController);
  }
}
