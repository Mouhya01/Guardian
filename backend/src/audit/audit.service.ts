import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { AppConfigService } from '../config/app-config.service.js';
import { AuditReportDocument, AuditReportEntity } from '../database/schemas/audit-report.schema.js';
import { GeminiService } from '../gemini/gemini.service.js';
import type { NormalizedFile } from './audit.types.js';
import { AuditHistoryItemDto } from './dto/audit-history-item.dto.js';
import { AuditReportDto } from './dto/audit-report.dto.js';
import { PaginatedAuditHistoryDto } from './dto/paginated-audit-history.dto.js';
import { decodeUtf8, isLikelyBinary, sanitizeFilePath } from './file-sanitizer.util.js';

@Injectable()
export class AuditService {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly appConfig: AppConfigService,
    @InjectModel(AuditReportEntity.name) private readonly auditReportModel: Model<AuditReportEntity>,
  ) {}

  async runAudit(files: Express.Multer.File[], userId: string): Promise<AuditReportDto> {
    const normalizedFiles = this.validateAndNormalizeFiles(files);
    const analysis = await this.geminiService.analyze(normalizedFiles);

    const saved = await this.auditReportModel.create({
      userId,
      summary: analysis.summary,
      overallRiskLevel: analysis.overallRiskLevel,
      findings: analysis.findings,
      filesAnalyzed: normalizedFiles.map((file) => file.path),
    });

    return this.toReportDto(saved as AuditReportDocument);
  }

  async findHistory(userId: string, page: number, limit: number): Promise<PaginatedAuditHistoryDto> {
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      this.auditReportModel.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.auditReportModel.countDocuments({ userId }).exec(),
    ]);

    const items: AuditHistoryItemDto[] = docs.map((doc) => ({
      id: doc.id as string,
      summary: doc.summary,
      overallRiskLevel: doc.overallRiskLevel,
      fileCount: doc.filesAnalyzed.length,
      generatedAt: this.getGeneratedAt(doc as AuditReportDocument),
    }));

    return { items, total, page, limit };
  }

  /** Scoped to the requesting user — a report that exists but belongs to someone else is reported as 404, not 403, to avoid leaking its existence. */
  async findById(userId: string, id: string): Promise<AuditReportDto> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid audit report id.');
    }

    const doc = await this.auditReportModel.findOne({ _id: id, userId }).exec();
    if (!doc) {
      throw new NotFoundException('Audit report not found.');
    }

    return this.toReportDto(doc as AuditReportDocument);
  }

  /**
   * Rejects the whole request (rather than silently dropping bad files) so the
   * caller always knows exactly which files were excluded and why.
   */
  validateAndNormalizeFiles(files: Express.Multer.File[]): NormalizedFile[] {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file must be uploaded.');
    }

    if (files.length > this.appConfig.auditMaxFilesPerRequest) {
      throw new BadRequestException(
        `Too many files: received ${files.length}, maximum allowed is ${this.appConfig.auditMaxFilesPerRequest}.`,
      );
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > this.appConfig.auditMaxTotalPayloadBytes) {
      throw new PayloadTooLargeException(
        `Total upload size (${totalSize} bytes) exceeds the ${this.appConfig.auditMaxTotalPayloadBytes} byte limit.`,
      );
    }

    const rejected: string[] = [];
    const normalized: NormalizedFile[] = [];
    const seenPaths = new Set<string>();

    for (const file of files) {
      if (file.size > this.appConfig.auditMaxFileSizeBytes) {
        rejected.push(`${file.originalname} (exceeds ${this.appConfig.auditMaxFileSizeBytes} byte limit)`);
        continue;
      }

      const safePath = sanitizeFilePath(file.originalname);
      if (!safePath) {
        rejected.push(`${file.originalname} (unsafe or invalid file path)`);
        continue;
      }

      if (isLikelyBinary(file.buffer)) {
        rejected.push(`${file.originalname} (binary content is not supported)`);
        continue;
      }

      const content = decodeUtf8(file.buffer);
      if (content === null) {
        rejected.push(`${file.originalname} (not valid UTF-8 text)`);
        continue;
      }

      const uniquePath = seenPaths.has(safePath) ? `${safePath}#${normalized.length}` : safePath;
      seenPaths.add(uniquePath);
      normalized.push({ path: uniquePath, content, sizeBytes: file.size });
    }

    if (rejected.length > 0) {
      throw new BadRequestException(`Rejected file(s): ${rejected.join(', ')}`);
    }

    return normalized;
  }

  private toReportDto(doc: AuditReportDocument): AuditReportDto {
    return {
      id: doc.id as string,
      summary: doc.summary,
      overallRiskLevel: doc.overallRiskLevel,
      findings: doc.findings.map((finding) => ({
        severity: finding.severity,
        filePath: finding.filePath,
        lineNumber: finding.lineNumber,
        title: finding.title,
        description: finding.description,
        category: finding.category,
        cveReferences: finding.cveReferences,
        remediation: finding.remediation,
        remediationCodeSnippet: finding.remediationCodeSnippet,
      })),
      filesAnalyzed: doc.filesAnalyzed,
      generatedAt: this.getGeneratedAt(doc),
    };
  }

  private getGeneratedAt(doc: AuditReportDocument): string {
    const createdAt = (doc as unknown as { createdAt?: Date }).createdAt;
    return (createdAt ?? new Date()).toISOString();
  }
}
