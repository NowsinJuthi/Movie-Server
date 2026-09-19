import { Controller, Get, Header, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { SkipLicense } from '../common/decorators/skip-license.decorator';
import { SiteSettingsService } from './site-settings.service';

@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Public()
  @SkipLicense()
  @Get('branding')
  @Header('Cache-Control', 'public, max-age=30')
  async branding() {
    return this.settings.getPublicBranding();
  }

  @Public()
  @SkipLicense()
  @Get('features')
  @Header('Cache-Control', 'public, max-age=15')
  async features() {
    return this.settings.getPublicFeatures();
  }

  @Public()
  @SkipLicense()
  @SkipThrottle()
  @Get('branding/logo')
  @Header('Cache-Control', 'public, max-age=300')
  async logo(@Res() res: Response) {
    const { stream, mime } = await this.settings.openLogo();
    res.type(mime);
    stream.pipe(res);
  }

  @Public()
  @SkipLicense()
  @SkipThrottle()
  @Get('branding/favicon')
  @Header('Cache-Control', 'public, max-age=300')
  async favicon(@Res() res: Response) {
    const { stream, mime } = await this.settings.openFavicon();
    res.type(mime);
    stream.pipe(res);
  }
}
