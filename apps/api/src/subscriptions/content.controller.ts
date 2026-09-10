import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { PlanFeature, VideoQuality } from '@movie-server/shared';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/auth.types';
import { RequireFeature, RequireQuality, RequireSubscription } from './decorators/subscription.decorators';
import { SubscriptionAccessService } from './subscription-access.service';
import { PlaybackAuthDto } from './dto/subscription.dto';

@Controller('content')
export class ContentController {
  constructor(private readonly access: SubscriptionAccessService) {}

  @Get('premium')
  @RequireSubscription()
  @RequireFeature(PlanFeature.Catalog)
  premium(@Req() req: Request) {
    return {
      message: 'Premium catalog unlocked.',
      entitlement: req.entitlement,
    };
  }

  @Get('uhd-preview')
  @RequireSubscription()
  @RequireFeature(PlanFeature.Uhd)
  @RequireQuality(VideoQuality.Uhd)
  uhd(@Req() req: Request) {
    return {
      message: 'UHD / 4K preview authorized.',
      entitlement: req.entitlement,
    };
  }

  @Post('playback-auth')
  @HttpCode(HttpStatus.OK)
  @RequireSubscription()
  async playbackAuth(@CurrentUser() user: RequestUser, @Body() dto: PlaybackAuthDto) {
    const entitlement = await this.access.assertPlayback(user.id, {
      quality: dto.quality,
      currentStreamCount: dto.currentStreamCount,
      registeredDeviceCount: dto.registeredDeviceCount,
    });
    return {
      allowed: true,
      entitlement,
    };
  }
}
