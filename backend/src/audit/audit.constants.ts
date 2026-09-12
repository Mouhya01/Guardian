function readEnvInt(key: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Read directly from process.env (not AppConfigService) because these back
 * multer's Interceptor options, which are built at decorator/module-load
 * time, before Nest's DI container exists. They share the same env vars as
 * AppConfigService so both stay in sync; this is only a hard backstop — the
 * authoritative, per-request checks (including aggregate payload size) run
 * in AuditService via AppConfigService.
 */
export const AUDIT_MAX_FILE_SIZE_BYTES = readEnvInt('AUDIT_MAX_FILE_SIZE_BYTES', 2 * 1024 * 1024);
export const AUDIT_MAX_FILES_PER_REQUEST = readEnvInt('AUDIT_MAX_FILES_PER_REQUEST', 50);
