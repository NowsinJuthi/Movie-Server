import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { BillingService } from './billing.service';
import { AdminRefundDto } from './dto/billing.dto';

@Controller('admin/billing')
@Roles(UserRole.Admin)
export class AdminBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('payments')
  list(@Query('status') status?: string, @Query('userId') userId?: string) {
    return this.billing.adminList(status, userId);
  }

  @Get('invoices')
  async invoices(@Query('userId') userId?: string) {
    const data = await this.billing.adminList(undefined, userId);
    return { invoices: data.invoices };
  }

  @Post('payments/:id/refund')
  refund(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: AdminRefundDto) {
    return this.billing.refund(id, dto.amountCents, dto.reason);
  }
}
