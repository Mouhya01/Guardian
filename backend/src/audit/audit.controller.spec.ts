import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AuditController } from './audit.controller.js';
import type { AuditService } from './audit.service.js';

const user: AuthenticatedUser = { id: 'user-1', email: 'a@example.com', emailVerified: true };

describe('AuditController', () => {
  it('delegates the uploaded files and the authenticated user id to AuditService.runAudit', async () => {
    const expectedReport = {
      id: 'report-1',
      summary: 'ok',
      overallRiskLevel: 'LOW',
      findings: [],
      filesAnalyzed: ['a.js'],
      generatedAt: new Date().toISOString(),
    };
    const auditService = { runAudit: vi.fn().mockResolvedValue(expectedReport) };
    const controller = new AuditController(auditService as unknown as AuditService);
    const files = [{ originalname: 'a.js' }] as Express.Multer.File[];

    const result = await controller.audit(user, files);

    expect(auditService.runAudit).toHaveBeenCalledWith(files, 'user-1');
    expect(result).toBe(expectedReport);
  });

  it('delegates history lookups to AuditService.findHistory, scoped to the user', async () => {
    const expected = { items: [], total: 0, page: 1, limit: 20 };
    const auditService = { findHistory: vi.fn().mockResolvedValue(expected) };
    const controller = new AuditController(auditService as unknown as AuditService);

    const result = await controller.history(user, { page: 1, limit: 20 });

    expect(auditService.findHistory).toHaveBeenCalledWith('user-1', 1, 20);
    expect(result).toBe(expected);
  });

  it('delegates single-report lookups to AuditService.findById, scoped to the user', async () => {
    const expected = { id: 'report-1', summary: 'ok' };
    const auditService = { findById: vi.fn().mockResolvedValue(expected) };
    const controller = new AuditController(auditService as unknown as AuditService);

    const result = await controller.findOne(user, 'report-1');

    expect(auditService.findById).toHaveBeenCalledWith('user-1', 'report-1');
    expect(result).toBe(expected);
  });
});
