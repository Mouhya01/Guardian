import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AppConfigService } from '../config/app-config.service.js';
import { GeminiModule } from '../gemini/gemini.module.js';
import { AuditRateLimitMiddleware } from './audit-rate-limit.middleware.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';

@Module({
  imports: [
    GeminiModule,
    // registerAsync (not a static object literal) so the limits are read from
    // AppConfigService via DI *after* ConfigModule has loaded .env — a plain
    // top-level `process.env.X` read here would run during ES module
    // evaluation, before dotenv has populated it.
    MulterModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService) => ({
        // In-memory only — uploaded content is never written to disk.
        storage: memoryStorage(),
        limits: { fileSize: appConfig.auditMaxFileSizeBytes, files: appConfig.auditMaxFilesPerRequest },
      }),
    }),
  ],
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuditRateLimitMiddleware).forRoutes(AuditController);
  }
}
