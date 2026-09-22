import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class EmailDomainPolicyEmb {
  @Prop({ type: [String], default: [] })
  allowlist!: string[];

  @Prop({ type: [String], default: [] })
  blocklist!: string[];

  /** Admin saved policy; skips auto default allowlist seed. */
  @Prop({ default: false })
  customized!: boolean;
}

@Schema({
  timestamps: true,
  collection: 'site_settings',
})
export class SiteSettings {
  @Prop({ required: true, unique: true, default: 'instance' })
  singleton!: string;

  @Prop({ type: String, default: null })
  siteName?: string | null;

  @Prop({ type: String, default: null })
  logoKey?: string | null;

  @Prop({ type: String, default: null })
  logoLightKey?: string | null;

  @Prop({ type: String, default: null })
  logoDarkKey?: string | null;

  @Prop({ type: String, default: null })
  faviconKey?: string | null;

  @Prop({ default: false })
  smtpEnabled!: boolean;

  @Prop({ type: String, default: '' })
  smtpHost!: string;

  @Prop({ default: 587 })
  smtpPort!: number;

  @Prop({ default: false })
  smtpSecure!: boolean;

  @Prop({ type: String, default: '' })
  smtpUser!: string;

  /** AES-GCM encrypted SMTP password (v1.… payload). */
  @Prop({ type: String, default: null })
  smtpPasswordEnc?: string | null;

  @Prop({ type: String, default: '' })
  mailFromName!: string;

  @Prop({ type: String, default: '' })
  mailFromEmail!: string;

  @Prop({ default: false })
  movieUploadRequestsEnabled!: boolean;

  @Prop({ type: EmailDomainPolicyEmb, default: () => ({}) })
  emailDomains!: EmailDomainPolicyEmb;

  createdAt!: Date;
  updatedAt!: Date;
}

export type SiteSettingsDocument = HydratedDocument<SiteSettings>;
export const SiteSettingsSchema = SchemaFactory.createForClass(SiteSettings);
