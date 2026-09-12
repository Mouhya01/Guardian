import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { GeminiService } from '../gemini/gemini.service.js';
import type { NormalizedFile } from './audit.types.js';
import { AuditReportDto } from './dto/audit-report.dto.js';
import { decodeUtf8, isLikelyBinary, sanitizeFilePath } from './file-sanitizer.util.js';

@Injectable()
export class AuditService {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly appConfig: AppConfigService,
  ) {}

  async runAudit(files: Express.Multer.File[]): Promise<AuditReportDto> {
    const normalizedFiles = this.validateAndNormalizeFiles(files);
    const analysis = await this.geminiService.analyze(normalizedFiles);

    return {
      ...analysis,
      filesAnalyzed: normalizedFiles.map((file) => file.path),
      generatedAt: new Date().toISOString(),
    };
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
}
