import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfigService } from '../config/app-config.service.js';
import { GeminiService } from '../gemini/gemini.service.js';
import { RiskLevel } from './dto/risk-level.enum.js';
import { Severity } from './dto/severity.enum.js';
import { AuditService } from './audit.service.js';

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  const content = overrides.buffer ?? Buffer.from('console.log("hello");', 'utf-8');
  return {
    fieldname: 'files',
    originalname: 'app.js',
    encoding: '7bit',
    mimetype: 'text/javascript',
    size: content.length,
    buffer: content,
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  } as Express.Multer.File;
}

function makeAppConfig(overrides: Partial<AppConfigService> = {}): AppConfigService {
  return {
    auditMaxFileSizeBytes: 1024,
    auditMaxFilesPerRequest: 5,
    auditMaxTotalPayloadBytes: 4096,
    ...overrides,
  } as AppConfigService;
}

describe('AuditService', () => {
  let geminiService: { analyze: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    geminiService = { analyze: vi.fn() };
  });

  it('rejects an empty file list', () => {
    const service = new AuditService(geminiService as unknown as GeminiService, makeAppConfig());
    expect(() => service.validateAndNormalizeFiles([])).toThrow(BadRequestException);
  });

  it('rejects more files than the configured maximum', () => {
    const service = new AuditService(geminiService as unknown as GeminiService, makeAppConfig({ auditMaxFilesPerRequest: 1 }));
    expect(() => service.validateAndNormalizeFiles([makeFile(), makeFile({ originalname: 'b.js' })])).toThrow(
      BadRequestException,
    );
  });

  it('rejects an aggregate payload larger than the configured maximum', () => {
    const service = new AuditService(geminiService as unknown as GeminiService, makeAppConfig({ auditMaxTotalPayloadBytes: 10 }));
    expect(() => service.validateAndNormalizeFiles([makeFile()])).toThrow(PayloadTooLargeException);
  });

  it('rejects a single oversized file', () => {
    const service = new AuditService(geminiService as unknown as GeminiService, makeAppConfig({ auditMaxFileSizeBytes: 5 }));
    expect(() => service.validateAndNormalizeFiles([makeFile()])).toThrow(BadRequestException);
  });

  it('rejects a file with a path-traversal name', () => {
    const service = new AuditService(geminiService as unknown as GeminiService, makeAppConfig());
    expect(() => service.validateAndNormalizeFiles([makeFile({ originalname: '../../etc/passwd' })])).toThrow(
      BadRequestException,
    );
  });

  it('rejects binary file content', () => {
    const service = new AuditService(geminiService as unknown as GeminiService, makeAppConfig());
    const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]);
    expect(() => service.validateAndNormalizeFiles([makeFile({ buffer: binary, size: binary.length })])).toThrow(
      BadRequestException,
    );
  });

  it('normalizes a valid set of files and de-duplicates identical paths', () => {
    const service = new AuditService(geminiService as unknown as GeminiService, makeAppConfig());
    const result = service.validateAndNormalizeFiles([
      makeFile({ originalname: 'src/a.js' }),
      makeFile({ originalname: 'src/a.js' }),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('src/a.js');
    expect(result[1].path).toBe('src/a.js#1');
  });

  it('runAudit validates files, delegates to GeminiService, and stamps filesAnalyzed/generatedAt', async () => {
    geminiService.analyze.mockResolvedValue({
      summary: 'Looks reasonable overall.',
      overallRiskLevel: RiskLevel.LOW,
      findings: [
        {
          severity: Severity.LOW,
          filePath: 'src/a.js',
          title: 'Minor issue',
          description: 'Not a big deal.',
          remediation: 'Fix it anyway.',
        },
      ],
    });

    const service = new AuditService(geminiService as unknown as GeminiService, makeAppConfig());
    const report = await service.runAudit([makeFile({ originalname: 'src/a.js' })]);

    expect(geminiService.analyze).toHaveBeenCalledWith([
      { path: 'src/a.js', content: 'console.log("hello");', sizeBytes: 'console.log("hello");'.length },
    ]);
    expect(report.filesAnalyzed).toEqual(['src/a.js']);
    expect(report.summary).toBe('Looks reasonable overall.');
    expect(new Date(report.generatedAt).toString()).not.toBe('Invalid Date');
  });
});
