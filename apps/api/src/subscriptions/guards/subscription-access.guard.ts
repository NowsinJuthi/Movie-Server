import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanFeature, VideoQuality } from '@movie-server/shared';
import { Request } from 'express';
import {
  SUBSCRIPTION_FEATURE_KEY,
  SUBSCRIPTION_QUALITY_KEY,
  SUBSCRIPTION_REQUIRED_KEY,
} from '../../common/constants';
import { SubscriptionAccessService } from '../subscription-access.service';

@Injectable()
export class SubscriptionAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: SubscriptionAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(SUBSCRIPTION_REQUIRED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const feature = this.reflector.getAllAndOverride<PlanFeature>(SUBSCRIPTION_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const quality = this.reflector.getAllAndOverride<VideoQuality>(SUBSCRIPTION_QUALITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required && !feature && !quality) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.user?.id;
    if (!userId) {
      return false;
    }

    let entitlement = await this.access.assertEntitled(userId);
    if (feature && !entitlement.features.includes(feature)) {
      entitlement = await this.access.assertFeature(userId, feature);
    }
    if (quality) {
      entitlement = await this.access.assertQuality(userId, quality);
    }
    request.entitlement = entitlement;
    return true;
  }
}
