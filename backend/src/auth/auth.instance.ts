import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { bearer } from 'better-auth/plugins';
import type { Db } from 'mongodb';
import type { AppConfigService } from '../config/app-config.service.js';

/**
 * `bearer()` lets the future Next.js frontend authenticate with an
 * `Authorization: Bearer <token>` header (converted internally to a session
 * cookie) instead of relying solely on cross-origin cookies — simpler and
 * more robust for a separate frontend/backend deployment.
 */
export function createAuthInstance(db: Db, appConfig: AppConfigService) {
  if (!appConfig.betterAuthSecret) {
    throw new Error('BETTER_AUTH_SECRET is not configured. Set it in backend/.env before starting the server.');
  }

  return betterAuth({
    database: mongodbAdapter(db),
    secret: appConfig.betterAuthSecret,
    baseURL: appConfig.betterAuthBaseUrl,
    trustedOrigins: appConfig.corsAllowedOrigins,
    emailAndPassword: { enabled: true },
    plugins: [bearer()],
  });
}

export type AuthInstance = ReturnType<typeof createAuthInstance>;
