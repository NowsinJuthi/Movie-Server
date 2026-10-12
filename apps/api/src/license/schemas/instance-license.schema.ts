import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'instance_license',
})
export class InstanceLicense {
  /** Singleton marker — only one document should exist. */
  @Prop({ required: true, unique: true, default: 'instance' })
  singleton!: string;

  @Prop({ required: true })
  installId!: string;

  @Prop({ required: true })
  installedAt!: Date;

  @Prop({ type: String, default: null })
  licenseKeyFingerprint?: string | null;

  @Prop({ type: String, default: null })
  licenseJti?: string | null;

  @Prop({ type: String, default: null })
  edition?: 'standard' | 'pro' | null;

  @Prop({ type: Date, default: null })
  licenseExpiresAt?: Date | null;

  @Prop({ type: Date, default: null })
  activatedAt?: Date | null;

  @Prop({ default: false })
  licensed!: boolean;

  /** local = CV1 self-hosted; central = license.amarpin.com (AMP-…). */
  @Prop({ type: String, enum: ['local', 'central'], default: null })
  licenseProvider?: 'local' | 'central' | null;

  /** AES-GCM blob for central keys (re-validation). */
  @Prop({ type: String, default: null })
  licenseKeyEnc?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type InstanceLicenseDocument = HydratedDocument<InstanceLicense>;
export const InstanceLicenseSchema = SchemaFactory.createForClass(InstanceLicense);
