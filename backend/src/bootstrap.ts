import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/app-config.service.js';

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const appConfig = app.get(AppConfigService);

  // Global rate limiting, the ValidationPipe and the exception filter are registered
  // as Nest providers/middleware in AppModule so they're active in e2e tests too —
  // helmet, CORS and Swagger stay here as process-level, bootstrap-only concerns.
  app.use(helmet());
  app.enableCors({ origin: appConfig.corsAllowedOrigins, credentials: true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Guardian API')
    .setDescription(
      'AI-powered security auditing platform — vulnerability analysis, secret detection and remediation reporting.',
    )
    .setVersion('0.2.0')
    .addTag('audit', 'Multi-file upload and Gemini-powered security analysis')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`[Worker ${process.pid}] Guardian API listening on port ${port} — docs at /api/docs`);
}
