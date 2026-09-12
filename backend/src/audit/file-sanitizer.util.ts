const MAX_PATH_LENGTH = 1024;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f]/;

/**
 * Normalizes an uploaded file's original name into a safe relative path, or
 * returns null when it cannot be made safe (path traversal, absolute path,
 * null/control bytes, empty segments). Never writes to disk — this only
 * guards the path string used in prompts and reports.
 */
export function sanitizeFilePath(originalName: string): string | null {
  if (!originalName || originalName.length > MAX_PATH_LENGTH || CONTROL_CHARS.test(originalName)) {
    return null;
  }

  const normalized = originalName.replace(/\\/g, '/');
  const segments = normalized.split('/').filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return null;
  }

  const isUnsafeSegment = segments.some((segment) => segment === '.' || segment === '..');
  if (isUnsafeSegment) {
    return null;
  }

  return segments.join('/');
}

/** Heuristic: a NUL byte in the first slice of content reliably indicates binary data. */
export function isLikelyBinary(buffer: Buffer): boolean {
  const sampleSize = Math.min(buffer.length, 8000);
  for (let i = 0; i < sampleSize; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

/** Decodes a buffer as strict UTF-8, or returns null if it isn't valid text. */
export function decodeUtf8(buffer: Buffer): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}
