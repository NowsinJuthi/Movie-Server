import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PlanFeature, PlanTier, VideoQuality } from '@movie-server/shared';
import { Plan, PlanDocument } from './schemas/plan.schema';
import { Subscription, SubscriptionDocument } from './schemas/subscription.schema';

const DEFAULT_PLANS: Array<{
  slug: string;
  name: string;
  description: string;
  tier: PlanTier;
  rank: number;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  maxVideoQuality: VideoQuality;
  maxDevices: number;
  maxStreams: number;
  features: PlanFeature[];
  trialDays: number;
  isActive: boolean;
  sortOrder: number;
}> = [
  {
    slug: 'basic',
    name: 'Basic',
    description: 'Watch on one device in standard definition.',
    tier: PlanTier.Basic,
    rank: 1,
    monthlyPriceCents: 999,
    yearlyPriceCents: 9999,
    maxVideoQuality: VideoQuality.Sd,
    maxDevices: 1,
    maxStreams: 1,
    features: [PlanFeature.Catalog],
    trialDays: 7,
    isActive: true,
    sortOrder: 1,
  },
  {
    slug: 'standard',
    name: 'Standard',
    description: 'HD on two screens at once, plus downloads.',
    tier: PlanTier.Standard,
    rank: 2,
    monthlyPriceCents: 1599,
    yearlyPriceCents: 15999,
    maxVideoQuality: VideoQuality.Hd,
    maxDevices: 2,
    maxStreams: 2,
    features: [PlanFeature.Catalog, PlanFeature.Hd, PlanFeature.Downloads],
    trialDays: 7,
    isActive: true,
    sortOrder: 2,
  },
  {
    slug: 'premium',
    name: 'Premium',
    description: 'Ultra HD, four simultaneous streams, HDR and spatial audio.',
    tier: PlanTier.Premium,
    rank: 3,
    monthlyPriceCents: 2299,
    yearlyPriceCents: 22999,
    maxVideoQuality: VideoQuality.Uhd,
    maxDevices: 4,
    maxStreams: 4,
    features: [
      PlanFeature.Catalog,
      PlanFeature.Hd,
      PlanFeature.Uhd,
      PlanFeature.Downloads,
      PlanFeature.Hdr,
      PlanFeature.SpatialAudio,
    ],
    trialDays: 7,
    isActive: true,
    sortOrder: 3,
  },
];

@Injectable()
export class PlansBootstrap implements OnModuleInit {
  private readonly logger = new Logger(PlansBootstrap.name);

  constructor(
    @InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>,
    @InjectModel(Subscription.name) private readonly subModel: Model<SubscriptionDocument>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const currency = this.config.getOrThrow<string>('SUBSCRIPTION_DEFAULT_CURRENCY');
    const existing = await this.planModel.countDocuments();
    if (existing === 0) {
      await this.planModel.insertMany(DEFAULT_PLANS.map((plan) => ({ ...plan, currency })));
      this.logger.log(`Seeded Basic, Standard, and Premium subscription plans (${currency}).`);
      return;
    }

    const [plans, subs] = await Promise.all([
      this.planModel.updateMany({ currency: 'USD' }, { $set: { currency } }),
      this.subModel.updateMany({ currency: 'USD' }, { $set: { currency } }),
    ]);
    if (plans.modifiedCount > 0 || subs.modifiedCount > 0) {
      this.logger.log(
        `Updated legacy USD pricing to ${currency} (${plans.modifiedCount} plans, ${subs.modifiedCount} subscriptions).`,
      );
    }
  }
}
