import { SetMetadata } from '@nestjs/common';
import { SUBSCRIPTION_REQUIRED_KEY } from '../../common/constants';

/** Override class-level @RequireSubscription() for token-authenticated media byte routes. */
export const SkipSubscription = () => SetMetadata(SUBSCRIPTION_REQUIRED_KEY, false);
