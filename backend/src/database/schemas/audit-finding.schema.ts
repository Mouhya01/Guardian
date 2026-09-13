import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Severity } from '../../audit/dto/severity.enum.js';

/** Embedded subdocument — no independent identity, so `_id` is disabled. */
@Schema({ _id: false })
export class AuditFindingSchemaClass {
  @Prop({ type: String, required: true, enum: Severity })
  severity!: Severity;

  @Prop({ required: true })
  filePath!: string;

  @Prop()
  lineNumber?: number;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  description!: string;

  @Prop()
  category?: string;

  @Prop({ type: [String] })
  cveReferences?: string[];

  @Prop({ required: true })
  remediation!: string;

  @Prop()
  remediationCodeSnippet?: string;
}

export const AuditFindingSchema = SchemaFactory.createForClass(AuditFindingSchemaClass);
