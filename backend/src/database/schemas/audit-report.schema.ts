import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { RiskLevel } from '../../audit/dto/risk-level.enum.js';
import { AuditFindingSchema, AuditFindingSchemaClass } from './audit-finding.schema.js';

export type AuditReportDocument = HydratedDocument<AuditReportEntity>;

/**
 * `timestamps: true` gives every document `createdAt`/`updatedAt` — used as the
 * report's generation time rather than storing a redundant separate field.
 */
@Schema({ timestamps: true, collection: 'audit_reports' })
export class AuditReportEntity {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  summary!: string;

  @Prop({ type: String, required: true, enum: RiskLevel })
  overallRiskLevel!: RiskLevel;

  @Prop({ type: [AuditFindingSchema], required: true, default: [] })
  findings!: AuditFindingSchemaClass[];

  @Prop({ type: [String], required: true })
  filesAnalyzed!: string[];
}

export const AuditReportSchema = SchemaFactory.createForClass(AuditReportEntity);
