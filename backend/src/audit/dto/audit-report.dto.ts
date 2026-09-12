import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsString, MaxLength, ValidateNested } from 'class-validator';
import { AuditFindingDto } from './audit-finding.dto.js';
import { RiskLevel } from './risk-level.enum.js';

export class AuditReportDto {
  @ApiProperty({ description: 'High-level summary of the security posture across all analyzed files' })
  @IsString()
  @MaxLength(4000)
  summary!: string;

  @ApiProperty({ enum: RiskLevel, description: 'Aggregate risk level across all findings' })
  @IsEnum(RiskLevel)
  overallRiskLevel!: RiskLevel;

  @ApiProperty({ type: [AuditFindingDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AuditFindingDto)
  findings!: AuditFindingDto[];

  @ApiProperty({ type: [String], description: 'Relative paths of every file included in this audit' })
  @IsArray()
  @IsString({ each: true })
  filesAnalyzed!: string[];

  @ApiProperty({ description: 'ISO-8601 timestamp when the report was generated' })
  @IsDateString()
  generatedAt!: string;
}
