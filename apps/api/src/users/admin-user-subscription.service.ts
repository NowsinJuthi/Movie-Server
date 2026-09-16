import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AdminUserSubscriptionSummary } from '@movie-server/shared';
import { Plan, PlanDocument } from '../subscriptions/schemas/plan.schema';
import { Subscription, SubscriptionDocument } from '../subscriptions/schemas/subscription.schema';
import {
  fallbackPlan,
  toPublicPlan,
  toPublicSubscription,
} from '../subscriptions/subscription.mapper';

@Injectable()
export class AdminUserSubscriptionService {
  constructor(
    @InjectModel(Subscription.name) private readonly subModel: Model<SubscriptionDocument>,
    @InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>,
  ) {}

  async summariesForUsers(userIds: string[]) {
    const unique = [...new Set(userIds.filter(Boolean))];
    const result = new Map<string, AdminUserSubscriptionSummary>();
    if (unique.length === 0) {
      return result;
    }

    const rows = await this.subModel.find({ userId: { $in: unique }, isCurrent: true }).exec();
    for (const row of rows) {
      const summary = await this.summarize(row);
      result.set(String(row.userId), summary);
    }
    return result;
  }

  private async summarize(sub: SubscriptionDocument): Promise<AdminUserSubscriptionSummary> {
    const planDoc = await this.planModel.findById(sub.planId).exec();
    const plan = planDoc ? toPublicPlan(planDoc) : fallbackPlan(sub);
    const publicSub = toPublicSubscription(sub, plan);
    return {
      id: String(sub._id),
      status: publicSub.status,
      planSlug: publicSub.plan.slug,
      planName: publicSub.plan.name,
      billingCycle: publicSub.billingCycle,
      entitled: publicSub.entitled,
      currentPeriodEnd: publicSub.currentPeriodEnd,
    };
  }
}
