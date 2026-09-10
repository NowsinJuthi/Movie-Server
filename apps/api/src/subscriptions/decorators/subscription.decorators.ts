import { SetMetadata } from '@nestjs/common';
import { PlanFeature, VideoQuality } from '@movie-server/shared';
import {
  SUBSCRIPTION_FEATURE_KEY,
  SUBSCRIPTION_QUALITY_KEY,
  SUBSCRIPTION_REQUIRED_KEY,
} from '../../common/constants';

export const RequireSubscription = () => SetMetadata(SUBSCRIPTION_REQUIRED_KEY, true);

export const RequireFeature = (feature: PlanFeature) => SetMetadata(SUBSCRIPTION_FEATURE_KEY, feature);

export const RequireQuality = (quality: VideoQuality) => SetMetadata(SUBSCRIPTION_QUALITY_KEY, quality);
