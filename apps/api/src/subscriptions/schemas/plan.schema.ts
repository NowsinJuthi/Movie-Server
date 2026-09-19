import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  PLAN_FEATURES,
  PLAN_TIERS,
  PlanFeature,
  PlanTier,
  VIDEO_QUALITIES,
  VideoQuality,
} from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'plans',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      return ret;
    },
  },
})
export class Plan {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, maxlength: 40 })
  slug!: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ required: true, trim: true, maxlength: 400 })
  description!: string;

  @Prop({ type: String, enum: PLAN_TIERS, required: true })
  tier!: PlanTier;

  @Prop({ required: true, min: 1, max: 100 })
  rank!: number;

  @Prop({ required: true, uppercase: true, match: /^[A-Z]{3}$/, default: 'BDT' })
  currency!: string;

  @Prop({ required: true, min: 0 })
  monthlyPriceCents!: number;

  @Prop({ required: true, min: 0 })
  yearlyPriceCents!: number;

  @Prop({ type: String, enum: VIDEO_QUALITIES, required: true })
  maxVideoQuality!: VideoQuality;

  @Prop({ required: true, min: 1, max: 20 })
  maxDevices!: number;

  @Prop({ required: true, min: 1, max: 20 })
  maxStreams!: number;

  @Prop({ type: [String], enum: PLAN_FEATURES, default: [] })
  features!: PlanFeature[];

  @Prop({ default: 0, min: 0, max: 365 })
  trialDays!: number;

  @Prop({ default: true, index: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type PlanDocument = HydratedDocument<Plan>;
export const PlanSchema = SchemaFactory.createForClass(Plan);

PlanSchema.index({ isActive: 1, sortOrder: 1 });
PlanSchema.index({ rank: 1 });
