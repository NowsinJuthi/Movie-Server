import {
  emptyEntitlement,
  isEntitledStatus,
  PlanTier,
  type PlanFeature,
  type PublicPlan,
  type PublicSubscription,
  type PublicSubscriptionEvent,
  type SubscriptionEntitlement,
  type VideoQuality,
} from '@movie-server/shared';
import { PlanDocument } from './schemas/plan.schema';
import { SubscriptionDocument } from './schemas/subscription.schema';
import { SubscriptionEventDocument } from './schemas/subscription-event.schema';

export function toPublicPlan(plan: PlanDocument): PublicPlan {
  return {
    id: String(plan._id),
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    tier: plan.tier,
    rank: plan.rank,
    currency: plan.currency,
    monthlyPriceCents: plan.monthlyPriceCents,
    yearlyPriceCents: plan.yearlyPriceCents,
    maxVideoQuality: plan.maxVideoQuality,
    maxDevices: plan.maxDevices,
    maxStreams: plan.maxStreams,
    features: plan.features,
    trialDays: plan.trialDays,
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
  };
}

export function snapshotPlan(plan: PlanDocument): {
  planId: PlanDocument['_id'];
  planSlug: string;
  planRank: number;
  maxVideoQuality: VideoQuality;
  maxDevices: number;
  maxStreams: number;
  features: PlanFeature[];
  currency: string;
} {
  return {
    planId: plan._id,
    planSlug: plan.slug,
    planRank: plan.rank,
    maxVideoQuality: plan.maxVideoQuality,
    maxDevices: plan.maxDevices,
    maxStreams: plan.maxStreams,
    features: plan.features,
    currency: plan.currency,
  };
}

export function toPublicSubscription(
  sub: SubscriptionDocument,
  plan: PublicPlan,
  now = new Date(),
): PublicSubscription {
  return {
    id: String(sub._id),
    userId: String(sub.userId),
    plan,
    billingCycle: sub.billingCycle,
    status: sub.status,
    currency: sub.currency,
    priceCents: sub.priceCents,
    autoRenew: sub.autoRenew,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    startedAt: sub.startedAt.toISOString(),
    currentPeriodStart: sub.currentPeriodStart.toISOString(),
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    trialStart: sub.trialStart?.toISOString() ?? null,
    trialEnd: sub.trialEnd?.toISOString() ?? null,
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    endedAt: sub.endedAt?.toISOString() ?? null,
    gracePeriodEndsAt: sub.gracePeriodEndsAt?.toISOString() ?? null,
    scheduledPlanId: sub.scheduledPlanId ? String(sub.scheduledPlanId) : null,
    scheduledBillingCycle: sub.scheduledBillingCycle ?? null,
    scheduledChangeAt: sub.scheduledChangeAt?.toISOString() ?? null,
    paymentProvider: sub.paymentProvider,
    externalPaymentRef: sub.externalPaymentRef ?? null,
    lastRenewedAt: sub.lastRenewedAt?.toISOString() ?? null,
    isCurrent: sub.isCurrent,
    entitled: isEntitledStatus(sub.status, now, sub.currentPeriodEnd, sub.gracePeriodEndsAt),
  };
}

export function toEntitlement(
  sub: SubscriptionDocument | null,
  livePlan?: PlanDocument | null,
  now = new Date(),
): SubscriptionEntitlement {
  if (!sub) {
    return emptyEntitlement();
  }
  const entitled = isEntitledStatus(sub.status, now, sub.currentPeriodEnd, sub.gracePeriodEndsAt);
  return {
    entitled,
    status: sub.status,
    planSlug: livePlan?.slug ?? sub.planSlug,
    tierRank: livePlan?.rank ?? sub.planRank,
    maxVideoQuality: livePlan?.maxVideoQuality ?? sub.maxVideoQuality,
    maxDevices: livePlan?.maxDevices ?? sub.maxDevices,
    maxStreams: livePlan?.maxStreams ?? sub.maxStreams,
    features: livePlan?.features ?? sub.features,
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    gracePeriodEndsAt: sub.gracePeriodEndsAt?.toISOString() ?? null,
    trialEnd: sub.trialEnd?.toISOString() ?? null,
  };
}

export function toPublicEvent(event: SubscriptionEventDocument): PublicSubscriptionEvent {
  return {
    id: String(event._id),
    subscriptionId: String(event.subscriptionId),
    type: event.type,
    fromPlanSlug: event.fromPlanSlug ?? null,
    toPlanSlug: event.toPlanSlug ?? null,
    fromStatus: event.fromStatus ?? null,
    toStatus: event.toStatus ?? null,
    billingCycle: event.billingCycle ?? null,
    note: event.note ?? null,
    createdAt: event.createdAt.toISOString(),
  };
}

export function fallbackPlan(sub: SubscriptionDocument): PublicPlan {
  return {
    id: String(sub.planId),
    slug: sub.planSlug,
    name: sub.planSlug,
    description: '',
    tier: PlanTier.Basic,
    rank: sub.planRank,
    currency: sub.currency,
    monthlyPriceCents: sub.billingCycle === 'monthly' ? sub.priceCents : 0,
    yearlyPriceCents: sub.billingCycle === 'yearly' ? sub.priceCents : 0,
    maxVideoQuality: sub.maxVideoQuality,
    maxDevices: sub.maxDevices,
    maxStreams: sub.maxStreams,
    features: sub.features,
    trialDays: 0,
    isActive: false,
    sortOrder: sub.planRank,
  };
}
