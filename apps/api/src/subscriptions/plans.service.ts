import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ErrorCode, PLAN_TIER_RANK, PlanTier } from '@movie-server/shared';
import { Plan, PlanDocument } from './schemas/plan.schema';
import { AdminUpdatePlanDto, AdminUpsertPlanDto } from './dto/admin-plan.dto';
import { toPublicPlan } from './subscription.mapper';

@Injectable()
export class PlansService {
  constructor(@InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>) {}

  listActive() {
    return this.planModel.find({ isActive: true }).sort({ sortOrder: 1, rank: 1 }).exec();
  }

  listAll() {
    return this.planModel.find().sort({ sortOrder: 1, rank: 1 }).exec();
  }

  findBySlug(slug: string) {
    return this.planModel.findOne({ slug: slug.toLowerCase() }).exec();
  }

  findById(id: string) {
    return this.planModel.findById(id).exec();
  }

  async getActiveBySlug(slug: string): Promise<PlanDocument> {
    const plan = await this.findBySlug(slug);
    if (!plan || !plan.isActive) {
      throw new NotFoundException({
        error: ErrorCode.PlanNotFound,
        message: 'Plan not found.',
      });
    }
    return plan;
  }

  async getById(id: string): Promise<PlanDocument> {
    const plan = await this.findById(id);
    if (!plan) {
      throw new NotFoundException({
        error: ErrorCode.PlanNotFound,
        message: 'Plan not found.',
      });
    }
    return plan;
  }

  async create(dto: AdminUpsertPlanDto): Promise<PlanDocument> {
    return this.planModel.create({
      ...dto,
      slug: dto.slug.toLowerCase(),
      currency: (dto.currency ?? 'USD').toUpperCase(),
      rank: dto.rank ?? PLAN_TIER_RANK[dto.tier],
      features: dto.features ?? [],
      trialDays: dto.trialDays ?? 0,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? PLAN_TIER_RANK[dto.tier],
    });
  }

  async update(id: string, dto: AdminUpdatePlanDto): Promise<PlanDocument> {
    const plan = await this.getById(id);
    if (dto.name !== undefined) plan.name = dto.name;
    if (dto.description !== undefined) plan.description = dto.description;
    if (dto.tier !== undefined) plan.tier = dto.tier;
    if (dto.rank !== undefined) {
      plan.rank = dto.rank;
    } else if (dto.tier !== undefined) {
      plan.rank = PLAN_TIER_RANK[dto.tier];
    }
    if (dto.currency !== undefined) plan.currency = dto.currency.toUpperCase();
    if (dto.monthlyPriceCents !== undefined) plan.monthlyPriceCents = dto.monthlyPriceCents;
    if (dto.yearlyPriceCents !== undefined) plan.yearlyPriceCents = dto.yearlyPriceCents;
    if (dto.maxVideoQuality !== undefined) plan.maxVideoQuality = dto.maxVideoQuality;
    if (dto.maxDevices !== undefined) plan.maxDevices = dto.maxDevices;
    if (dto.maxStreams !== undefined) plan.maxStreams = dto.maxStreams;
    if (dto.features !== undefined) plan.features = dto.features;
    if (dto.trialDays !== undefined) plan.trialDays = dto.trialDays;
    if (dto.isActive !== undefined) plan.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) plan.sortOrder = dto.sortOrder;
    await plan.save();
    return plan;
  }

  async deactivate(id: string): Promise<PlanDocument> {
    const plan = await this.getById(id);
    plan.isActive = false;
    await plan.save();
    return plan;
  }

  toPublic = toPublicPlan;

  defaultRank(tier: PlanTier): number {
    return PLAN_TIER_RANK[tier];
  }
}
