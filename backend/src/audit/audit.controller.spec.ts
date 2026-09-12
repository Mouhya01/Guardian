import { describe, expect, it, vi } from 'vitest';
import { AuditController } from './audit.controller.js';
import type { AuditService } from './audit.service.js';

describe('AuditController', () => {
  it('delegates the uploaded files to AuditService.runAudit', async () => {
    const expectedReport = {
      summary: 'ok',
      overallRiskLevel: 'LOW',
      findings: [],
      filesAnalyzed: ['a.js'],
      generatedAt: new Date().toISOString(),
    };
    const auditService = { runAudit: vi.fn().mockResolvedValue(expectedReport) };
    const controller = new AuditController(auditService as unknown as AuditService);
    const files = [{ originalname: 'a.js' }] as Express.Multer.File[];

    const result = await controller.audit(files);

    expect(auditService.runAudit).toHaveBeenCalledWith(files);
    expect(result).toBe(expectedReport);
  });
});
