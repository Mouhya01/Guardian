import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Severity } from './severity.enum.js';

export class AuditFindingDto {
  @ApiProperty({ enum: Severity })
  @IsEnum(Severity)
  severity!: Severity;

  @ApiProperty({ description: 'Relative path of the analyzed file this finding applies to', example: 'src/auth/login.controller.ts' })
  @IsString()
  @MaxLength(1024)
  filePath!: string;

  @ApiPropertyOptional({ description: 'Line number where the issue occurs, when applicable' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  lineNumber?: number;

  @ApiProperty({ description: 'Short human-readable title for the finding', example: 'Hardcoded AWS secret key' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'Detailed explanation of the vulnerability or misconfiguration' })
  @IsString()
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional({ description: 'Vulnerability category, e.g. an OWASP Top 10 label or misconfiguration class', example: 'A02:2021 - Cryptographic Failures' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  category?: string;

  @ApiPropertyOptional({ type: [String], description: 'CVE identifiers, when the finding maps to a known vulnerability' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  cveReferences?: string[];

  @ApiProperty({ description: 'Concrete steps to remediate the finding' })
  @IsString()
  @MaxLength(4000)
  remediation!: string;

  @ApiPropertyOptional({ description: 'Fixed code snippet demonstrating the remediation' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  remediationCodeSnippet?: string;
}
