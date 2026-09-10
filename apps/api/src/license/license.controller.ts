import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { SkipLicense } from '../common/decorators/skip-license.decorator';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { LicenseService } from './license.service';

@Controller('license')
@Public()
@SkipLicense()
export class LicenseController {
  constructor(private readonly license: LicenseService) {}

  @Get('status')
  status() {
    return this.license.getStatus(true);
  }

  @Post('activate')
  @Throttle({ default: { limit: 8, ttl: 900_000 } })
  activate(@Body() body: ActivateLicenseDto) {
    return this.license.activate(body.licenseKey);
  }
}
