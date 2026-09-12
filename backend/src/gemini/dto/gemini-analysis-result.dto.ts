import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsString, MaxLength, ValidateNested } from 'class-validator';
import { AuditFindingDto } from '../../audit/dto/audit-finding.dto.js';
import { RiskLevel } from '../../audit/dto/risk-level.enum.js';

/**
 * Shape of the data we require FROM Gemini — everything else in the final
 * AuditReportDto (filesAnalyzed, generatedAt) is computed by AuditService,
 * never trusted from the model's output.
 */
export class GeminiAnalysisResultDto {
  @IsString()
  @MaxLength(4000)
  summary!: string;

  @IsEnum(RiskLevel)
  overallRiskLevel!: RiskLevel;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AuditFindingDto)
  findings!: AuditFindingDto[];
}
