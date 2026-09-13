import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function parseIntEnv(raw: string | undefined, fallback: number): number {
  const parsed = raw === undefined ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Typed, centralized accessor for env-driven settings — keeps parsing/defaults
 * in one tested place instead of scattered `parseInt(process.env.X)` calls.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get geminiApiKey(): string | undefined {
    const value = this.config.get<string>('GEMINI_API_KEY');
    return value && value.trim().length > 0 ? value.trim() : undefined;
  }

  get geminiApiEndpoint(): string {
    return this.config.get<string>('GEMINI_API_ENDPOINT') ?? 'https://generativelanguage.googleapis.com/v1beta';
  }

  get geminiModel(): string {
    return this.config.get<string>('GEMINI_MODEL') ?? 'gemini-flash-latest';
  }

  get geminiTimeoutMs(): number {
    return parseIntEnv(this.config.get<string>('GEMINI_TIMEOUT_MS'), 60_000);
  }

  get geminiMaxRetries(): number {
    return parseIntEnv(this.config.get<string>('GEMINI_MAX_RETRIES'), 2);
  }

  get auditRateLimitWindowMs(): number {
    return parseIntEnv(this.config.get<string>('AUDIT_RATE_LIMIT_WINDOW_MS'), 15 * 60 * 1000);
  }

  get auditRateLimitMaxRequests(): number {
    return parseIntEnv(this.config.get<string>('AUDIT_RATE_LIMIT_MAX_REQUESTS'), 10);
  }

  get auditMaxFileSizeBytes(): number {
    return parseIntEnv(this.config.get<string>('AUDIT_MAX_FILE_SIZE_BYTES'), 2 * 1024 * 1024);
  }

  get auditMaxFilesPerRequest(): number {
    return parseIntEnv(this.config.get<string>('AUDIT_MAX_FILES_PER_REQUEST'), 50);
  }

  get auditMaxTotalPayloadBytes(): number {
    return parseIntEnv(this.config.get<string>('AUDIT_MAX_TOTAL_PAYLOAD_BYTES'), 20 * 1024 * 1024);
  }

  get globalRateLimitWindowMs(): number {
    return parseIntEnv(this.config.get<string>('RATE_LIMIT_WINDOW_MS'), 15 * 60 * 1000);
  }

  get globalRateLimitMaxRequests(): number {
    return parseIntEnv(this.config.get<string>('RATE_LIMIT_MAX_REQUESTS'), 100);
  }

  /** Origins allowed to call this API cross-origin — the Next.js frontend in dev/prod. */
  get corsAllowedOrigins(): string[] {
    const raw = this.config.get<string>('CORS_ALLOWED_ORIGINS');
    if (!raw || raw.trim().length === 0) {
      return ['http://localhost:3001'];
    }
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  get mongodbUri(): string | undefined {
    const value = this.config.get<string>('MONGODB_URI');
    return value && value.trim().length > 0 ? value.trim() : undefined;
  }

  get betterAuthSecret(): string | undefined {
    const value = this.config.get<string>('BETTER_AUTH_SECRET');
    return value && value.trim().length > 0 ? value.trim() : undefined;
  }

  /** This API's own base URL (used by Better Auth for cookie/callback construction) — not the frontend's origin. */
  get betterAuthBaseUrl(): string {
    const configured = this.config.get<string>('BETTER_AUTH_URL');
    if (configured && configured.trim().length > 0) {
      return configured.trim();
    }
    const port = this.config.get<string>('PORT') ?? '3000';
    return `http://localhost:${port}`;
  }
}
