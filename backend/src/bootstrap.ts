import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { toNodeHandler } from 'better-auth/node';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AUTH_INSTANCE } from './auth/auth.constants.js';
import type { AuthInstance } from './auth/auth.instance.js';
import { AppConfigService } from './config/app-config.service.js';

export async function bootstrap(): Promise<void> {
  // Body parsing is disabled here and re-added below, after the Better Auth
  // handler is mounted — Better Auth needs the raw, unparsed request body.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const appConfig = app.get(AppConfigService);
  const auth = app.get<AuthInstance>(AUTH_INSTANCE);

  app.use('/api/auth/{*splat}', toNodeHandler(auth));
  app.useBodyParser('json');
  app.useBodyParser('urlencoded', { extended: true });

  // Global rate limiting, the ValidationPipe and the exception filter are registered
  // as Nest providers/middleware in AppModule so they're active in e2e tests too —
  // helmet, CORS and Swagger stay here as process-level, bootstrap-only concerns.
  app.use(helmet());
  app.enableCors({ origin: appConfig.corsAllowedOrigins, credentials: true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Guardian API')
    .setDescription(
      'AI-powered security auditing platform — vulnerability analysis, secret detection and remediation reporting. ' +
        'Authentication (sign-up/sign-in/sign-out/session) is handled by Better Auth, mounted at /api/auth/* — ' +
        'those routes are not shown below since they are not Nest-decorated controllers. ' +
        'See https://better-auth.com for the endpoint reference; call POST /api/auth/sign-up/email and ' +
        'POST /api/auth/sign-in/email with { email, password }, then send the returned session as ' +
        '"Authorization: Bearer <token>" on protected routes below.',
    )
    .setVersion('0.3.0')
    .addTag('audit', 'Multi-file upload, Gemini-powered security analysis, and audit history')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`[Worker ${process.pid}] Guardian API listening on port ${port} — docs at /api/docs`);
}
