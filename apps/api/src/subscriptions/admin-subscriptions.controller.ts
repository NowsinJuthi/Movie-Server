import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { SubscriptionsService } from './subscriptions.service';
import {
  AdminActivatePaymentDto,
  AdminGrantSubscriptionDto,
  AdminPatchSubscriptionDto,
  AdminSuspendDto,
} from './dto/subscription.dto';

@Controller('admin/subscriptions')
@Roles(UserRole.Admin)
export class AdminSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  @Permissions('view_subscriptions')
  async list(@Query('userId') userId?: string, @Query('status') status?: string) {
    const rows = await this.subscriptions.listForAdmin(userId, status);
    return {
      subscriptions: await Promise.all(rows.map((row) => this.subscriptions.toAdminResponse(row))),
    };
  }

  @Post()
  @Permissions('manage_subscriptions')
  async grant(@Body() dto: AdminGrantSubscriptionDto) {
    const sub = await this.subscriptions.grantComplimentary({
      userId: dto.userId,
      planSlug: dto.planSlug,
      billingCycle: dto.billingCycle,
      status: dto.status,
    });
    return { subscription: await this.subscriptions.toResponse(sub) };
  }

  @Patch(':id')
  @Permissions('manage_subscriptions')
  async patch(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: AdminPatchSubscriptionDto) {
    const sub = await this.subscriptions.adminPatch(id, dto);
    return { subscription: await this.subscriptions.toResponse(sub) };
  }

  @Post(':id/activate')
  @Permissions('manage_subscriptions')
  async activate(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AdminActivatePaymentDto,
  ) {
    const sub = await this.subscriptions.activateFromPayment(id, {
      provider: dto.provider ?? 'internal',
      externalRef: dto.externalRef ?? `admin-${id}`,
    });
    return { subscription: await this.subscriptions.toResponse(sub) };
  }

  @Post(':id/suspend')
  @Permissions('manage_subscriptions')
  async suspend(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: AdminSuspendDto) {
    const sub = await this.subscriptions.suspend(id, dto.reason ?? 'admin_suspend');
    return { subscription: await this.subscriptions.toResponse(sub) };
  }

  @Post(':id/unsuspend')
  @Permissions('manage_subscriptions')
  async unsuspend(@Param('id', ParseObjectIdPipe) id: string) {
    const sub = await this.subscriptions.unsuspend(id);
    return { subscription: await this.subscriptions.toResponse(sub) };
  }
}
