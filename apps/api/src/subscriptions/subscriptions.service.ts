import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import {
  BillingCycle,
  ErrorCode,
  SubscriptionEventType,
  SubscriptionStatus,
} from '@movie-server/shared';
import { PlanDocument } from './schemas/plan.schema';
import { Subscription, SubscriptionDocument } from './schemas/subscription.schema';
import { SubscriptionEvent, SubscriptionEventDocument } from './schemas/subscription-event.schema';
import { PlansService } from './plans.service';
import { UsersService } from '../users/users.service';
import { DevicesService } from '../devices/devices.service';
import { PlaybackSessionStore } from '../stream/playback-session.store';
import { RedisService } from '../redis/redis.service';
import { entitlementCacheKey } from '../common/cache-keys';
import { addBillingCycle, addDays, priceForCycle } from './period';
import {
  fallbackPlan,
  snapshotPlan,
  toPublicEvent,
  toPublicPlan,
  toPublicSubscription,
} from './subscription.mapper';

/** Task 4 Payment & Billing calls these methods. Do not replace this service. */
export type PaymentActivationInput = {
  provider: string;
  externalRef: string;
  paidCents?: number;
};

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name) private readonly subModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionEvent.name)
    private readonly eventModel: Model<SubscriptionEventDocument>,
    private readonly plans: PlansService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    @Inject(forwardRef(() => DevicesService)) private readonly devices: DevicesService,
    @Inject(forwardRef(() => PlaybackSessionStore)) private readonly sessions: PlaybackSessionStore,
  ) {}

  requirePayment(): boolean {
    return this.config.get<boolean>('SUBSCRIPTION_REQUIRE_PAYMENT') === true;
  }

  graceDays(): number {
    return this.config.get<number>('SUBSCRIPTION_GRACE_DAYS') ?? 3;
  }

  findCurrent(userId: string) {
    return this.subModel.findOne({ userId, isCurrent: true }).exec();
  }

  findById(id: string, session?: ClientSession | null) {
    const query = this.subModel.findById(id);
    if (session) {
      query.session(session);
    }
    return query.exec();
  }

  async hasUsedTrial(userId: string): Promise<boolean> {
    const found = await this.subModel.exists({
      userId,
      trialStart: { $ne: null },
    });
    return Boolean(found);
  }

  async getCurrentForUser(userId: string): Promise<SubscriptionDocument | null> {
    const sub = await this.reconcile(userId);
    return sub;
  }

  async toResponse(sub: SubscriptionDocument) {
    const planDoc = await this.plans.findById(String(sub.planId));
    const plan = planDoc ? toPublicPlan(planDoc) : fallbackPlan(sub);
    return toPublicSubscription(sub, plan);
  }

  async toAdminResponse(sub: SubscriptionDocument) {
    const base = await this.toResponse(sub);
    const userId = String(sub.userId);
    const [user, deviceCount, streamCount] = await Promise.all([
      this.users.findById(userId),
      this.devices.countingDevices(userId),
      this.sessions.listActive(userId).then((rows) => rows.length),
    ]);
    return {
      ...base,
      userEmail: user?.email ?? '',
      userDisplayName: user?.displayName ?? '',
      deviceCount,
      streamCount,
      maxDevices: sub.maxDevices,
      maxStreams: sub.maxStreams,
    };
  }

  async start(
    userId: string,
    planSlug: string,
    billingCycle: BillingCycle,
  ): Promise<{ subscription: SubscriptionDocument; paymentRequired: boolean }> {
    const existing = await this.reconcile(userId);
    if (existing && this.blocksNewSubscription(existing)) {
      throw new ConflictException({
        error: ErrorCode.Conflict,
        message: 'An active or pending subscription already exists. Change or cancel it instead.',
      });
    }

    const plan = await this.plans.getActiveBySlug(planSlug);
    const now = new Date();
    const trialEligible = plan.trialDays > 0 && !(await this.hasUsedTrial(userId));

    if (existing) {
      existing.isCurrent = false;
      await existing.save();
    }

    const snapshot = snapshotPlan(plan);
    let status: SubscriptionStatus;
    let trialStart: Date | null = null;
    let trialEnd: Date | null = null;
    let currentPeriodEnd: Date;
    let paymentProvider = 'none';

    if (trialEligible) {
      status = SubscriptionStatus.Trial;
      trialStart = now;
      trialEnd = addDays(now, plan.trialDays);
      currentPeriodEnd = trialEnd;
    } else if (this.requirePayment()) {
      status = SubscriptionStatus.Pending;
      currentPeriodEnd = addBillingCycle(now, billingCycle);
    } else {
      status = SubscriptionStatus.Active;
      currentPeriodEnd = addBillingCycle(now, billingCycle);
      paymentProvider = 'internal';
    }

    const created = await this.subModel.create({
      userId,
      ...snapshot,
      billingCycle,
      status,
      priceCents: priceForCycle(plan.monthlyPriceCents, plan.yearlyPriceCents, billingCycle),
      autoRenew: true,
      cancelAtPeriodEnd: false,
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd,
      trialStart,
      trialEnd,
      paymentProvider,
      isCurrent: true,
    });

    await this.recordEvent(created, SubscriptionEventType.Created, {
      toPlanSlug: plan.slug,
      toStatus: status,
      billingCycle,
      note: trialEligible ? 'Started with free trial.' : 'Subscription created.',
    });
    if (trialEligible) {
      await this.recordEvent(created, SubscriptionEventType.TrialStarted, {
        toPlanSlug: plan.slug,
        toStatus: status,
        billingCycle,
        note: `Trial for ${plan.trialDays} days.`,
      });
    } else if (status === SubscriptionStatus.Pending) {
      await this.recordEvent(created, SubscriptionEventType.PaymentPending, {
        toPlanSlug: plan.slug,
        toStatus: status,
        billingCycle,
        note: 'Awaiting payment confirmation.',
      });
    } else {
      await this.recordEvent(created, SubscriptionEventType.Activated, {
        toPlanSlug: plan.slug,
        toStatus: status,
        billingCycle,
        note: 'Activated without external payment (Task 4 can replace this path).',
      });
    }

    return {
      subscription: created,
      paymentRequired: status === SubscriptionStatus.Pending,
    };
  }

  /**
   * Task 4: mark checkout as waiting for a provider invoice / PaymentIntent.
   */
  async markPaymentPending(
    subscriptionId: string,
    input: PaymentActivationInput,
    session?: ClientSession | null,
  ): Promise<SubscriptionDocument> {
    const sub = await this.requireById(subscriptionId, session);
    sub.status = SubscriptionStatus.Pending;
    sub.paymentProvider = input.provider;
    sub.externalPaymentRef = input.externalRef;
    await sub.save({ session: session ?? undefined });
    await this.recordEvent(
      sub,
      SubscriptionEventType.PaymentPending,
      {
        toStatus: SubscriptionStatus.Pending,
        note: 'Payment pending.',
        metadata: { ...input },
      },
      session,
    );
    return sub;
  }

  /**
   * Task 4: webhook/success path. Activates Pending, converts Trial, or recovers Suspended.
   * Idempotent when the same provider payment is applied twice.
   */
  async activateFromPayment(
    subscriptionId: string,
    input: PaymentActivationInput,
    session?: ClientSession | null,
  ): Promise<SubscriptionDocument> {
    const sub = await this.requireById(subscriptionId, session);
    if (
      sub.status === SubscriptionStatus.Active &&
      sub.externalPaymentRef &&
      sub.externalPaymentRef === input.externalRef
    ) {
      return sub;
    }
    const from = sub.status;
    const now = new Date();
    sub.paymentProvider = input.provider;
    sub.externalPaymentRef = input.externalRef;
    sub.autoRenew = true;
    sub.cancelAtPeriodEnd = false;
    sub.cancelledAt = null;
    sub.endedAt = null;
    sub.suspendedAt = null;
    sub.suspensionReason = null;
    sub.gracePeriodEndsAt = null;
    sub.status = SubscriptionStatus.Active;
    sub.lastRenewedAt = now;
    sub.isCurrent = true;

    if (from === SubscriptionStatus.Active) {
      const start = sub.currentPeriodEnd.getTime() > now.getTime() ? sub.currentPeriodEnd : now;
      sub.currentPeriodStart = start;
      sub.currentPeriodEnd = addBillingCycle(start, sub.billingCycle);
    } else if (
      from === SubscriptionStatus.Trial ||
      from === SubscriptionStatus.Pending ||
      from === SubscriptionStatus.Suspended ||
      from === SubscriptionStatus.Expired
    ) {
      sub.currentPeriodStart = now;
      sub.currentPeriodEnd = addBillingCycle(now, sub.billingCycle);
    }

    await sub.save({ session: session ?? undefined });
    await this.recordEvent(
      sub,
      SubscriptionEventType.Activated,
      {
        fromStatus: from,
        toStatus: sub.status,
        billingCycle: sub.billingCycle,
        note: 'Activated from payment.',
        metadata: { paidCents: input.paidCents, externalRef: input.externalRef },
      },
      session,
    );
    return sub;
  }

  /**
   * Task 4: renewal charge failed. Start grace, then expire on reconcile.
   */
  async recordFailedRenewal(
    subscriptionId: string,
    reason = 'renewal_failed',
    session?: ClientSession | null,
  ): Promise<SubscriptionDocument> {
    const sub = await this.requireById(subscriptionId, session);
    const from = sub.status;
    const now = new Date();
    sub.status = SubscriptionStatus.Suspended;
    sub.suspendedAt = now;
    sub.suspensionReason = reason;
    sub.gracePeriodEndsAt = addDays(now, this.graceDays());
    await sub.save({ session: session ?? undefined });
    await this.recordEvent(
      sub,
      SubscriptionEventType.Suspended,
      {
        fromStatus: from,
        toStatus: sub.status,
        note: reason,
      },
      session,
    );
    await this.recordEvent(
      sub,
      SubscriptionEventType.GraceStarted,
      {
        toStatus: sub.status,
        note: `Grace until ${sub.gracePeriodEndsAt.toISOString()}`,
      },
      session,
    );
    return sub;
  }

  async changePlan(
    userId: string,
    planSlug: string,
    billingCycle: BillingCycle,
  ): Promise<SubscriptionDocument> {
    const sub = await this.requireCurrent(userId);
    if (
      sub.status === SubscriptionStatus.Expired ||
      sub.status === SubscriptionStatus.Pending
    ) {
      throw new BadRequestException({
        error: ErrorCode.InvalidPlanChange,
        message: 'Cannot change plan in the current subscription state.',
      });
    }

    const plan = await this.plans.getActiveBySlug(planSlug);
    const samePlan = sub.planSlug === plan.slug && sub.billingCycle === billingCycle;
    if (samePlan && !sub.scheduledPlanId) {
      throw new BadRequestException({
        error: ErrorCode.InvalidPlanChange,
        message: 'You are already on this plan and billing cycle.',
      });
    }

    const upgrade =
      plan.rank > sub.planRank ||
      (plan.rank === sub.planRank && billingCycle === 'yearly' && sub.billingCycle === 'monthly');

    if (upgrade) {
      return this.applyImmediateChange(sub, plan, billingCycle, SubscriptionEventType.Upgraded);
    }

    sub.scheduledPlanId = plan._id;
    sub.scheduledBillingCycle = billingCycle;
    sub.scheduledChangeAt = sub.currentPeriodEnd;
    await sub.save();
    await this.recordEvent(sub, SubscriptionEventType.Downgraded, {
      fromPlanSlug: sub.planSlug,
      toPlanSlug: plan.slug,
      billingCycle,
      note: 'Downgrade scheduled for period end.',
    });
    return sub;
  }

  async cancel(userId: string): Promise<SubscriptionDocument> {
    const sub = await this.requireCurrent(userId);
    if (sub.status === SubscriptionStatus.Expired) {
      throw new BadRequestException({
        error: ErrorCode.InvalidPlanChange,
        message: 'Subscription is already expired.',
      });
    }
    if (sub.status === SubscriptionStatus.Cancelled && sub.cancelAtPeriodEnd) {
      return sub;
    }
    const from = sub.status;
    sub.status = SubscriptionStatus.Cancelled;
    sub.cancelAtPeriodEnd = true;
    sub.autoRenew = false;
    sub.cancelledAt = new Date();
    sub.scheduledPlanId = null;
    sub.scheduledBillingCycle = null;
    sub.scheduledChangeAt = null;
    await sub.save();
    await this.recordEvent(sub, SubscriptionEventType.Cancelled, {
      fromStatus: from,
      toStatus: sub.status,
      note: 'Cancelled; access continues until period end.',
    });
    return sub;
  }

  async resume(userId: string): Promise<SubscriptionDocument> {
    const sub = await this.requireCurrent(userId);
    if (sub.status !== SubscriptionStatus.Cancelled) {
      throw new BadRequestException({
        error: ErrorCode.InvalidPlanChange,
        message: 'Only a cancelled subscription can be resumed.',
      });
    }
    if (new Date() > sub.currentPeriodEnd) {
      throw new BadRequestException({
        error: ErrorCode.SubscriptionInactive,
        message: 'The billing period has already ended.',
      });
    }
    sub.status = sub.trialEnd && new Date() <= sub.trialEnd ? SubscriptionStatus.Trial : SubscriptionStatus.Active;
    sub.cancelAtPeriodEnd = false;
    sub.autoRenew = true;
    sub.cancelledAt = null;
    await sub.save();
    await this.recordEvent(sub, SubscriptionEventType.Resumed, {
      toStatus: sub.status,
      note: 'Cancellation undone.',
    });
    return sub;
  }

  async renew(userId: string): Promise<SubscriptionDocument> {
    const sub = await this.requireCurrent(userId);
    if (!sub.autoRenew || sub.cancelAtPeriodEnd) {
      throw new BadRequestException({
        error: ErrorCode.InvalidPlanChange,
        message: 'Auto-renew is off for this subscription.',
      });
    }
    if (this.requirePayment()) {
      return this.recordFailedRenewal(String(sub._id), 'renewal_requires_payment');
    }
    return this.extendPeriod(sub);
  }

  async suspend(subscriptionId: string, reason = 'admin_suspend'): Promise<SubscriptionDocument> {
    return this.recordFailedRenewal(subscriptionId, reason);
  }

  async adminDelete(id: string): Promise<{ id: string; userId: string }> {
    const sub = await this.requireById(id);
    const userId = String(sub.userId);
    const subscriptionId = String(sub._id);
    await this.recordEvent(sub, SubscriptionEventType.Cancelled, {
      fromStatus: sub.status,
      toStatus: SubscriptionStatus.Expired,
      note: 'Admin deleted subscription.',
    });
    await this.subModel.deleteOne({ _id: sub._id });
    await this.redis.client.del(entitlementCacheKey(userId));
    return { id: subscriptionId, userId };
  }

  async unsuspend(subscriptionId: string): Promise<SubscriptionDocument> {
    const sub = await this.requireById(subscriptionId);
    if (sub.status !== SubscriptionStatus.Suspended) {
      throw new BadRequestException({
        error: ErrorCode.InvalidPlanChange,
        message: 'Subscription is not suspended.',
      });
    }
    const from = sub.status;
    sub.status = SubscriptionStatus.Active;
    sub.suspendedAt = null;
    sub.suspensionReason = null;
    sub.gracePeriodEndsAt = null;
    if (new Date() > sub.currentPeriodEnd) {
      sub.currentPeriodStart = new Date();
      sub.currentPeriodEnd = addBillingCycle(new Date(), sub.billingCycle);
    }
    await sub.save();
    await this.recordEvent(sub, SubscriptionEventType.Unsuspended, {
      fromStatus: from,
      toStatus: sub.status,
      note: 'Access restored.',
    });
    return sub;
  }

  async grantComplimentary(input: {
    userId: string;
    planSlug: string;
    billingCycle: BillingCycle;
    status?: SubscriptionStatus;
  }): Promise<SubscriptionDocument> {
    const account = await this.users.findById(input.userId);
    if (!account) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'User not found.',
      });
    }
    const current = await this.findCurrent(input.userId);
    if (current) {
      current.isCurrent = false;
      await current.save();
    }
    const plan = await this.plans.getActiveBySlug(input.planSlug);
    const now = new Date();
    const status = input.status ?? SubscriptionStatus.Active;
    const periodEnd =
      status === SubscriptionStatus.Trial
        ? addDays(now, Math.max(plan.trialDays, 1))
        : addBillingCycle(now, input.billingCycle);
    const snapshot = snapshotPlan(plan);
    const created = await this.subModel.create({
      userId: input.userId,
      ...snapshot,
      billingCycle: input.billingCycle,
      status,
      priceCents: priceForCycle(plan.monthlyPriceCents, plan.yearlyPriceCents, input.billingCycle),
      autoRenew: status !== SubscriptionStatus.Pending,
      cancelAtPeriodEnd: false,
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialStart: status === SubscriptionStatus.Trial ? now : null,
      trialEnd: status === SubscriptionStatus.Trial ? periodEnd : null,
      paymentProvider: 'complimentary',
      isCurrent: true,
    });
    await this.recordEvent(created, SubscriptionEventType.Created, {
      toPlanSlug: plan.slug,
      toStatus: status,
      billingCycle: input.billingCycle,
      note: 'Admin grant.',
    });
    return created;
  }

  async adminPatch(
    id: string,
    patch: {
      status?: SubscriptionStatus;
      currentPeriodEnd?: string;
      trialEnd?: string;
      gracePeriodEndsAt?: string;
      scheduledChangeAt?: string;
      reason?: string;
      autoRenew?: boolean;
    },
  ): Promise<SubscriptionDocument> {
    const sub = await this.requireById(id);
    const from = sub.status;
    if (patch.currentPeriodEnd) {
      sub.currentPeriodEnd = new Date(patch.currentPeriodEnd);
    }
    if (patch.trialEnd) {
      sub.trialEnd = new Date(patch.trialEnd);
    }
    if (patch.gracePeriodEndsAt) {
      sub.gracePeriodEndsAt = new Date(patch.gracePeriodEndsAt);
    }
    if (patch.scheduledChangeAt) {
      sub.scheduledChangeAt = new Date(patch.scheduledChangeAt);
    }
    if (patch.autoRenew !== undefined) {
      sub.autoRenew = patch.autoRenew;
    }
    if (patch.status && patch.status !== sub.status) {
      sub.status = patch.status;
      if (patch.status === SubscriptionStatus.Cancelled) {
        sub.cancelAtPeriodEnd = true;
        sub.autoRenew = false;
        sub.cancelledAt = new Date();
      }
      if (patch.status === SubscriptionStatus.Expired) {
        sub.endedAt = new Date();
        sub.autoRenew = false;
      }
      if (patch.status === SubscriptionStatus.Suspended) {
        sub.suspendedAt = new Date();
        sub.suspensionReason = patch.reason ?? 'admin';
        sub.gracePeriodEndsAt = sub.gracePeriodEndsAt ?? addDays(new Date(), this.graceDays());
      }
      if (patch.status === SubscriptionStatus.Active) {
        sub.endedAt = null;
        sub.cancelledAt = null;
        sub.suspendedAt = null;
        sub.gracePeriodEndsAt = null;
      }
    }
    await sub.save();
    await this.redis.client.del(entitlementCacheKey(String(sub.userId)));
    if (patch.status && patch.status !== from) {
      await this.recordEvent(sub, SubscriptionEventType.PlanChanged, {
        fromStatus: from,
        toStatus: sub.status,
        note: patch.reason ?? 'Admin status update.',
      });
    }
    return sub;
  }

  async listForAdmin(userId?: string, status?: string) {
    const filter: Record<string, unknown> = {};
    if (userId) filter.userId = userId;
    if (status) filter.status = status;
    return this.subModel.find(filter).sort({ createdAt: -1 }).limit(200).exec();
  }

  async getCurrentSummariesForUsers(userIds: string[]) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) {
      return new Map<
        string,
        {
          userId: string;
          status: SubscriptionStatus;
          planSlug: string;
          planName: string;
          entitled: boolean;
          currentPeriodEnd: string;
        }
      >();
    }
    const rows = await this.subModel
      .find({ userId: { $in: unique }, isCurrent: true })
      .exec();
    const summaries = await Promise.all(rows.map((row) => this.summarizeForUser(row)));
    return new Map(summaries.map((item) => [item.userId, item]));
  }

  private async summarizeForUser(sub: SubscriptionDocument) {
    const planDoc = await this.plans.findById(String(sub.planId));
    const plan = planDoc ? toPublicPlan(planDoc) : fallbackPlan(sub);
    const publicSub = toPublicSubscription(sub, plan);
    return {
      userId: String(sub.userId),
      status: publicSub.status,
      planSlug: publicSub.plan.slug,
      planName: publicSub.plan.name,
      entitled: publicSub.entitled,
      currentPeriodEnd: publicSub.currentPeriodEnd,
    };
  }

  async history(userId: string) {
    const events = await this.eventModel.find({ userId }).sort({ createdAt: -1 }).limit(100).exec();
    return events.map(toPublicEvent);
  }

  async planChanges(userId: string) {
    const events = await this.eventModel
      .find({
        userId,
        type: {
          $in: [
            SubscriptionEventType.Upgraded,
            SubscriptionEventType.Downgraded,
            SubscriptionEventType.PlanChanged,
          ],
        },
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
    return events.map(toPublicEvent);
  }

  async reconcile(userId: string): Promise<SubscriptionDocument | null> {
    const sub = await this.findCurrent(userId);
    if (!sub) {
      return null;
    }
    const changed = await this.applyLifecycle(sub, new Date());
    if (changed) {
      await sub.save();
    }
    return sub;
  }

  async applyLifecycle(sub: SubscriptionDocument, now: Date): Promise<boolean> {
    let changed = false;

    if (sub.scheduledPlanId && sub.scheduledChangeAt && now.getTime() >= sub.scheduledChangeAt.getTime()) {
      const plan = await this.plans.findById(String(sub.scheduledPlanId));
      if (plan) {
        const fromSlug = sub.planSlug;
        this.copyPlanOntoSubscription(sub, plan, sub.scheduledBillingCycle ?? sub.billingCycle);
        sub.scheduledPlanId = null;
        sub.scheduledBillingCycle = null;
        sub.scheduledChangeAt = null;
        await this.recordEvent(sub, SubscriptionEventType.PlanChanged, {
          fromPlanSlug: fromSlug,
          toPlanSlug: plan.slug,
          billingCycle: sub.billingCycle,
          note: 'Scheduled plan change applied.',
        });
        changed = true;
      }
    }

    if (sub.status === SubscriptionStatus.Trial && sub.trialEnd && now.getTime() > sub.trialEnd.getTime()) {
      if (sub.autoRenew && !sub.cancelAtPeriodEnd && !this.requirePayment()) {
        sub.status = SubscriptionStatus.Active;
        sub.currentPeriodStart = now;
        sub.currentPeriodEnd = addBillingCycle(now, sub.billingCycle);
        sub.lastRenewedAt = now;
        sub.paymentProvider = sub.paymentProvider === 'none' ? 'internal' : sub.paymentProvider;
        await this.recordEvent(sub, SubscriptionEventType.Activated, {
          fromStatus: SubscriptionStatus.Trial,
          toStatus: sub.status,
          note: 'Trial converted to paid period.',
        });
      } else if (sub.autoRenew && !sub.cancelAtPeriodEnd && this.requirePayment()) {
        sub.status = SubscriptionStatus.Pending;
        await this.recordEvent(sub, SubscriptionEventType.PaymentPending, {
          fromStatus: SubscriptionStatus.Trial,
          toStatus: sub.status,
          note: 'Trial ended; payment required.',
        });
      } else {
        sub.status = SubscriptionStatus.Expired;
        sub.endedAt = now;
        await this.recordEvent(sub, SubscriptionEventType.Expired, {
          fromStatus: SubscriptionStatus.Trial,
          toStatus: sub.status,
          note: 'Trial ended without conversion.',
        });
      }
      changed = true;
    } else if (sub.status === SubscriptionStatus.Active && now.getTime() > sub.currentPeriodEnd.getTime()) {
      if (sub.autoRenew && !sub.cancelAtPeriodEnd) {
        if (this.requirePayment()) {
          sub.status = SubscriptionStatus.Suspended;
          sub.suspendedAt = now;
          sub.suspensionReason = 'renewal_requires_payment';
          sub.gracePeriodEndsAt = addDays(now, this.graceDays());
          await this.recordEvent(sub, SubscriptionEventType.GraceStarted, {
            fromStatus: SubscriptionStatus.Active,
            toStatus: sub.status,
            note: 'Awaiting renewal payment.',
          });
        } else {
          await this.extendPeriod(sub, now, false);
        }
      } else {
        sub.status = SubscriptionStatus.Expired;
        sub.endedAt = now;
        await this.recordEvent(sub, SubscriptionEventType.Expired, {
          fromStatus: SubscriptionStatus.Active,
          toStatus: sub.status,
          note: 'Period ended without renewal.',
        });
      }
      changed = true;
    } else if (
      sub.status === SubscriptionStatus.Cancelled &&
      now.getTime() > sub.currentPeriodEnd.getTime()
    ) {
      sub.status = SubscriptionStatus.Expired;
      sub.endedAt = now;
      await this.recordEvent(sub, SubscriptionEventType.Expired, {
        fromStatus: SubscriptionStatus.Cancelled,
        toStatus: sub.status,
        note: 'Cancelled subscription reached period end.',
      });
      changed = true;
    } else if (
      sub.status === SubscriptionStatus.Suspended &&
      sub.gracePeriodEndsAt &&
      now.getTime() > sub.gracePeriodEndsAt.getTime()
    ) {
      sub.status = SubscriptionStatus.Expired;
      sub.endedAt = now;
      await this.recordEvent(sub, SubscriptionEventType.Expired, {
        fromStatus: SubscriptionStatus.Suspended,
        toStatus: sub.status,
        note: 'Grace period ended.',
      });
      changed = true;
    }

    return changed;
  }

  private async extendPeriod(sub: SubscriptionDocument, now = new Date(), persist = true) {
    const fromEnd = sub.currentPeriodEnd;
    sub.status = SubscriptionStatus.Active;
    sub.currentPeriodStart = fromEnd.getTime() > now.getTime() ? fromEnd : now;
    sub.currentPeriodEnd = addBillingCycle(sub.currentPeriodStart, sub.billingCycle);
    sub.lastRenewedAt = now;
    sub.gracePeriodEndsAt = null;
    sub.suspendedAt = null;
    if (persist) {
      await sub.save();
    }
    await this.recordEvent(sub, SubscriptionEventType.Renewed, {
      toStatus: sub.status,
      billingCycle: sub.billingCycle,
      note: 'Period renewed.',
    });
    return sub;
  }

  private async applyImmediateChange(
    sub: SubscriptionDocument,
    plan: PlanDocument,
    billingCycle: BillingCycle,
    type: typeof SubscriptionEventType.Upgraded | typeof SubscriptionEventType.PlanChanged,
  ) {
    const fromSlug = sub.planSlug;
    const fromStatus = sub.status;
    this.copyPlanOntoSubscription(sub, plan, billingCycle);
    sub.scheduledPlanId = null;
    sub.scheduledBillingCycle = null;
    sub.scheduledChangeAt = null;
    await sub.save();
    await this.recordEvent(sub, type, {
      fromPlanSlug: fromSlug,
      toPlanSlug: plan.slug,
      fromStatus,
      toStatus: sub.status,
      billingCycle,
      note: 'Plan change applied immediately.',
    });
    return sub;
  }

  private copyPlanOntoSubscription(
    sub: SubscriptionDocument,
    plan: PlanDocument,
    billingCycle: BillingCycle,
  ) {
    const snapshot = snapshotPlan(plan);
    sub.planId = snapshot.planId as Types.ObjectId;
    sub.planSlug = snapshot.planSlug;
    sub.planRank = snapshot.planRank;
    sub.maxVideoQuality = snapshot.maxVideoQuality;
    sub.maxDevices = snapshot.maxDevices;
    sub.maxStreams = snapshot.maxStreams;
    sub.features = snapshot.features;
    sub.currency = snapshot.currency;
    sub.billingCycle = billingCycle;
    sub.priceCents = priceForCycle(plan.monthlyPriceCents, plan.yearlyPriceCents, billingCycle);
  }

  private blocksNewSubscription(sub: SubscriptionDocument): boolean {
    if (sub.status === SubscriptionStatus.Pending) {
      return true;
    }
    if (sub.status === SubscriptionStatus.Expired) {
      return false;
    }
    const now = new Date();
    if (sub.status === SubscriptionStatus.Cancelled && now.getTime() > sub.currentPeriodEnd.getTime()) {
      return false;
    }
    if (
      sub.status === SubscriptionStatus.Suspended &&
      sub.gracePeriodEndsAt &&
      now.getTime() > sub.gracePeriodEndsAt.getTime()
    ) {
      return false;
    }
    return (
      sub.status === SubscriptionStatus.Trial ||
      sub.status === SubscriptionStatus.Active ||
      sub.status === SubscriptionStatus.Cancelled ||
      sub.status === SubscriptionStatus.Suspended
    );
  }

  private async requireCurrent(userId: string): Promise<SubscriptionDocument> {
    const sub = await this.reconcile(userId);
    if (!sub) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'No subscription found.',
      });
    }
    return sub;
  }

  private async requireById(
    id: string,
    session?: ClientSession | null,
  ): Promise<SubscriptionDocument> {
    const sub = await this.findById(id, session);
    if (!sub) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'Subscription not found.',
      });
    }
    return sub;
  }

  private async recordEvent(
    sub: SubscriptionDocument,
    type: SubscriptionEventType,
    extra: Partial<{
      fromPlanSlug: string | null;
      toPlanSlug: string | null;
      fromStatus: SubscriptionStatus | null;
      toStatus: SubscriptionStatus | null;
      billingCycle: BillingCycle | null;
      note: string | null;
      metadata: Record<string, unknown>;
    }>,
    session?: ClientSession | null,
  ) {
    const payload = {
      subscriptionId: sub._id,
      userId: sub.userId,
      type,
      fromPlanSlug: extra.fromPlanSlug ?? null,
      toPlanSlug: extra.toPlanSlug ?? sub.planSlug,
      fromStatus: extra.fromStatus ?? null,
      toStatus: extra.toStatus ?? sub.status,
      billingCycle: extra.billingCycle ?? sub.billingCycle,
      note: extra.note ?? null,
      metadata: extra.metadata ?? {},
    };
    if (session) {
      await this.eventModel.create([payload], { session });
    } else {
      await this.eventModel.create(payload);
    }
    await this.redis.client.del(entitlementCacheKey(String(sub.userId)));
  }
}
