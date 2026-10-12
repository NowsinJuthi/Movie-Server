import { Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Permissions } from '../common/decorators/permissions.decorator';
import { SkipLicense } from '../common/decorators/skip-license.decorator';
import { LicenseService } from './license.service';

@Controller('license/admin')
@SkipLicense()
export class AdminLicenseController {
  constructor(private readonly license: LicenseService) {}

  @Post('deactivate')
  @Permissions('manage_license')
  @Throttle({ default: { limit: 8, ttl: 900_000 } })
  deactivate() {
    return this.license.deactivate();
  }
}
