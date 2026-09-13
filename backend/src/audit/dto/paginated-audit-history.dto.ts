import { ApiProperty } from '@nestjs/swagger';
import { AuditHistoryItemDto } from './audit-history-item.dto.js';

export class PaginatedAuditHistoryDto {
  @ApiProperty({ type: [AuditHistoryItemDto] })
  items!: AuditHistoryItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
