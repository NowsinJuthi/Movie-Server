import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/auth.types';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionAccessService } from './subscription-access.service';
import { ChangePlanDto, StartSubscriptionDto } from './dto/subscription.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly access: SubscriptionAccessService,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: RequestUser) {
    const sub = await this.subscriptions.getCurrentForUser(user.id);
    const entitlement = await this.access.getEntitlement(user.id);
    return {
      subscription: sub ? await this.subscriptions.toResponse(sub) : null,
      entitlement,
    };
  }

  @Get('me/entitlement')
  async entitlement(@CurrentUser() user: RequestUser) {
    return { entitlement: await this.access.getEntitlement(user.id) };
  }

  @Get('me/history')
  async history(@CurrentUser() user: RequestUser) {
    return { events: await this.subscriptions.history(user.id) };
  }

  @Get('me/changes')
  async changes(@CurrentUser() user: RequestUser) {
    return { events: await this.subscriptions.planChanges(user.id) };
  }

  @Post()
  async start(@CurrentUser() user: RequestUser, @Body() dto: StartSubscriptionDto) {
    const result = await this.subscriptions.start(user.id, dto.planSlug, dto.billingCycle);
    return {
      subscription: await this.subscriptions.toResponse(result.subscription),
      paymentRequired: result.paymentRequired,
      entitlement: await this.access.getEntitlement(user.id),
    };
  }

  @Post('me/change')
  @HttpCode(HttpStatus.OK)
  async change(@CurrentUser() user: RequestUser, @Body() dto: ChangePlanDto) {
    const sub = await this.subscriptions.changePlan(user.id, dto.planSlug, dto.billingCycle);
    return {
      subscription: await this.subscriptions.toResponse(sub),
      entitlement: await this.access.getEntitlement(user.id),
    };
  }

  @Post('me/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@CurrentUser() user: RequestUser) {
    const sub = await this.subscriptions.cancel(user.id);
    return {
      subscription: await this.subscriptions.toResponse(sub),
      entitlement: await this.access.getEntitlement(user.id),
    };
  }

  @Post('me/resume')
  @HttpCode(HttpStatus.OK)
  async resume(@CurrentUser() user: RequestUser) {
    const sub = await this.subscriptions.resume(user.id);
    return {
      subscription: await this.subscriptions.toResponse(sub),
      entitlement: await this.access.getEntitlement(user.id),
    };
  }

  @Post('me/renew')
  @HttpCode(HttpStatus.OK)
  async renew(@CurrentUser() user: RequestUser) {
    const sub = await this.subscriptions.renew(user.id);
    return {
      subscription: await this.subscriptions.toResponse(sub),
      entitlement: await this.access.getEntitlement(user.id),
    };
  }
}
