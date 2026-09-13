import { ApiProperty } from '@nestjs/swagger';
import { RiskLevel } from './risk-level.enum.js';

/** Lightweight summary used in the paginated history list — full findings are only in GET /audit/:id. */
export class AuditHistoryItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  summary!: string;

  @ApiProperty({ enum: RiskLevel })
  overallRiskLevel!: RiskLevel;

  @ApiProperty()
  fileCount!: number;

  @ApiProperty()
  generatedAt!: string;
}
