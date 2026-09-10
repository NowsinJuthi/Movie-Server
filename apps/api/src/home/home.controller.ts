import { Controller, Get, Req, Res } from '@nestjs/common';
import { PlanFeature } from '@movie-server/shared';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/auth.types';
import { RequireFeature, RequireSubscription } from '../subscriptions/decorators/subscription.decorators';
import { HomeService } from './home.service';

@Controller('home')
@RequireSubscription()
@RequireFeature(PlanFeature.Catalog)
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  async browse(@CurrentUser() user: RequestUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const payload = await this.home.get(user, req.entitlement ?? null);
    res.setHeader('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
    return payload;
  }
}
