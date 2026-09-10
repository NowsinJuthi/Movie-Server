import { SetMetadata } from '@nestjs/common';
import { SKIP_LICENSE_KEY } from '../constants';

/** Routes that remain available when the instance is license-locked (status/activate/health). */
export const SkipLicense = () => SetMetadata(SKIP_LICENSE_KEY, true);
