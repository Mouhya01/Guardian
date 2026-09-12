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
}
