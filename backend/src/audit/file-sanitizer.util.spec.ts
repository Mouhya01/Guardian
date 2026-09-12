import { describe, expect, it } from 'vitest';
import { decodeUtf8, isLikelyBinary, sanitizeFilePath } from './file-sanitizer.util.js';

describe('sanitizeFilePath', () => {
  it('accepts a simple nested relative path', () => {
    expect(sanitizeFilePath('src/app.controller.ts')).toBe('src/app.controller.ts');
  });

  it('normalizes backslashes to forward slashes', () => {
    expect(sanitizeFilePath('src\\utils\\foo.ts')).toBe('src/utils/foo.ts');
  });

  it('strips a leading slash', () => {
    expect(sanitizeFilePath('/etc/passwd')).toBe('etc/passwd');
  });

  it('rejects path traversal segments', () => {
    expect(sanitizeFilePath('../../etc/passwd')).toBeNull();
    expect(sanitizeFilePath('src/../../secrets.env')).toBeNull();
  });

  it('rejects a bare "." segment', () => {
    expect(sanitizeFilePath('./config.json')).toBeNull();
  });

  it('rejects an empty name', () => {
    expect(sanitizeFilePath('')).toBeNull();
  });

  it('rejects names containing control characters', () => {
    const controlCharByte = String.fromCharCode(1);
    expect(sanitizeFilePath(`evil${controlCharByte}name.txt`)).toBeNull();
  });

  it('rejects names longer than the max path length', () => {
    expect(sanitizeFilePath(`${'a'.repeat(1025)}.txt`)).toBeNull();
  });
});

describe('isLikelyBinary', () => {
  it('returns false for plain text', () => {
    expect(isLikelyBinary(Buffer.from('const x = 1;\nconsole.log(x);', 'utf-8'))).toBe(false);
  });

  it('returns true when a NUL byte is present', () => {
    expect(isLikelyBinary(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d]))).toBe(true);
  });
});

describe('decodeUtf8', () => {
  it('decodes valid UTF-8 content', () => {
    expect(decodeUtf8(Buffer.from('héllo wörld', 'utf-8'))).toBe('héllo wörld');
  });

  it('returns null for invalid UTF-8 byte sequences', () => {
    expect(decodeUtf8(Buffer.from([0xff, 0xfe, 0xfd, 0xfc]))).toBeNull();
  });
});
