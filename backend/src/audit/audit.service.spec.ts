import { BadRequestException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
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

function makeQueryChain<T>(result: T) {
  return {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(result),
  };
}

function makeModel(overrides: Record<string, unknown> = {}) {
  return {
    create: vi.fn(),
    find: vi.fn().mockReturnValue(makeQueryChain([])),
    countDocuments: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(0) }),
    findOne: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(null) }),
    ...overrides,
  };
}

const sampleFinding = {
  severity: Severity.LOW,
  filePath: 'src/a.js',
  title: 'Minor issue',
  description: 'Not a big deal.',
  remediation: 'Fix it anyway.',
};

describe('AuditService', () => {
  let geminiService: { analyze: ReturnType<typeof vi.fn> };
  let model: ReturnType<typeof makeModel>;

  beforeEach(() => {
    geminiService = { analyze: vi.fn() };
    model = makeModel();
  });

  function makeService(configOverrides: Partial<AppConfigService> = {}, modelOverrides: Record<string, unknown> = {}) {
    return new AuditService(
      geminiService as unknown as GeminiService,
      makeAppConfig(configOverrides),
      { ...model, ...modelOverrides } as never,
    );
  }

  it('rejects an empty file list', () => {
    const service = makeService();
    expect(() => service.validateAndNormalizeFiles([])).toThrow(BadRequestException);
  });

  it('rejects more files than the configured maximum', () => {
    const service = makeService({ auditMaxFilesPerRequest: 1 });
    expect(() => service.validateAndNormalizeFiles([makeFile(), makeFile({ originalname: 'b.js' })])).toThrow(
      BadRequestException,
    );
  });

  it('rejects an aggregate payload larger than the configured maximum', () => {
    const service = makeService({ auditMaxTotalPayloadBytes: 10 });
    expect(() => service.validateAndNormalizeFiles([makeFile()])).toThrow(PayloadTooLargeException);
  });

  it('rejects a single oversized file', () => {
    const service = makeService({ auditMaxFileSizeBytes: 5 });
    expect(() => service.validateAndNormalizeFiles([makeFile()])).toThrow(BadRequestException);
  });

  it('rejects a file with a path-traversal name', () => {
    const service = makeService();
    expect(() => service.validateAndNormalizeFiles([makeFile({ originalname: '../../etc/passwd' })])).toThrow(
      BadRequestException,
    );
  });

  it('rejects binary file content', () => {
    const service = makeService();
    const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]);
    expect(() => service.validateAndNormalizeFiles([makeFile({ buffer: binary, size: binary.length })])).toThrow(
      BadRequestException,
    );
  });

  it('normalizes a valid set of files and de-duplicates identical paths', () => {
    const service = makeService();
    const result = service.validateAndNormalizeFiles([
      makeFile({ originalname: 'src/a.js' }),
      makeFile({ originalname: 'src/a.js' }),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('src/a.js');
    expect(result[1].path).toBe('src/a.js#1');
  });

  describe('runAudit', () => {
    it('validates files, delegates to GeminiService, persists the report scoped to the user, and returns it', async () => {
      geminiService.analyze.mockResolvedValue({
        summary: 'Looks reasonable overall.',
        overallRiskLevel: RiskLevel.LOW,
        findings: [sampleFinding],
      });
      model.create.mockResolvedValue({
        id: 'report-1',
        summary: 'Looks reasonable overall.',
        overallRiskLevel: RiskLevel.LOW,
        findings: [sampleFinding],
        filesAnalyzed: ['src/a.js'],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const service = makeService();
      const report = await service.runAudit([makeFile({ originalname: 'src/a.js' })], 'user-1');

      expect(geminiService.analyze).toHaveBeenCalledWith([
        { path: 'src/a.js', content: 'console.log("hello");', sizeBytes: 'console.log("hello");'.length },
      ]);
      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', summary: 'Looks reasonable overall.' }),
      );
      expect(report.id).toBe('report-1');
      expect(report.filesAnalyzed).toEqual(['src/a.js']);
      expect(report.generatedAt).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('findHistory', () => {
    it('returns a paginated, user-scoped summary list', async () => {
      const docs = [
        {
          id: 'report-1',
          summary: 'S1',
          overallRiskLevel: RiskLevel.HIGH,
          findings: [sampleFinding],
          filesAnalyzed: ['a.js', 'b.js'],
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ];
      const findChain = makeQueryChain(docs);
      const service = makeService(
        {},
        {
          find: vi.fn().mockReturnValue(findChain),
          countDocuments: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(1) }),
        },
      );

      const result = await service.findHistory('user-1', 1, 20);

      expect(result.items).toEqual([
        { id: 'report-1', summary: 'S1', overallRiskLevel: RiskLevel.HIGH, fileCount: 2, generatedAt: '2026-01-02T00:00:00.000Z' },
      ]);
      expect(result.total).toBe(1);
      expect(findChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });

  describe('findById', () => {
    it('rejects an id that is not a valid ObjectId', async () => {
      const service = makeService();
      await expect(service.findById('user-1', 'not-an-id')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound when no report matches (including one owned by another user)', async () => {
      const service = makeService(
        {},
        { findOne: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(null) }) },
      );

      await expect(service.findById('user-1', '507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
    });

    it('scopes the lookup to the requesting user and returns the full report', async () => {
      const findOneMock = vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          id: 'report-1',
          summary: 'Full report',
          overallRiskLevel: RiskLevel.CRITICAL,
          findings: [sampleFinding],
          filesAnalyzed: ['a.js'],
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
        }),
      });
      const service = makeService({}, { findOne: findOneMock });

      const report = await service.findById('user-1', '507f1f77bcf86cd799439011');

      expect(findOneMock).toHaveBeenCalledWith({ _id: '507f1f77bcf86cd799439011', userId: 'user-1' });
      expect(report.summary).toBe('Full report');
      expect(report.findings).toEqual([sampleFinding]);
    });
  });
});
