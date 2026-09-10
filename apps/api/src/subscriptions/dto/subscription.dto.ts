import { IsBoolean, IsIn, IsInt, IsISO8601, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  BILLING_CYCLES,
  BillingCycle,
  SUBSCRIPTION_STATUSES,
  SubscriptionStatus,
  VIDEO_QUALITIES,
  VideoQuality,
} from '@movie-server/shared';
import { Trim } from '../../common/decorators/transform.decorators';

export class StartSubscriptionDto {
  @Trim()
  @IsString()
  planSlug!: string;

  @IsIn([...BILLING_CYCLES])
  billingCycle!: BillingCycle;
}

export class ChangePlanDto {
  @Trim()
  @IsString()
  planSlug!: string;

  @IsIn([...BILLING_CYCLES])
  billingCycle!: BillingCycle;
}

export class PlaybackAuthDto {
  @IsIn([...VIDEO_QUALITIES])
  quality!: VideoQuality;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  currentStreamCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  registeredDeviceCount?: number;
}

export class AdminGrantSubscriptionDto {
  @IsMongoId()
  userId!: string;

  @Trim()
  @IsString()
  planSlug!: string;

  @IsIn([...BILLING_CYCLES])
  billingCycle!: BillingCycle;

  @IsOptional()
  @IsIn([...SUBSCRIPTION_STATUSES])
  status?: SubscriptionStatus;
}

export class AdminPatchSubscriptionDto {
  @IsOptional()
  @IsIn([...SUBSCRIPTION_STATUSES])
  status?: SubscriptionStatus;

  @IsOptional()
  @IsISO8601()
  currentPeriodEnd?: string;

  @IsOptional()
  @IsISO8601()
  trialEnd?: string;

  @IsOptional()
  @IsISO8601()
  gracePeriodEndsAt?: string;

  @IsOptional()
  @IsISO8601()
  scheduledChangeAt?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}

export class AdminActivatePaymentDto {
  @IsOptional()
  @Trim()
  @IsString()
  provider?: string;

  @IsOptional()
  @Trim()
  @IsString()
  externalRef?: string;
}

export class AdminSuspendDto {
  @IsOptional()
  @Trim()
  @IsString()
  reason?: string;
}
