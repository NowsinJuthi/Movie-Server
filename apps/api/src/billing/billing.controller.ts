import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { RequestUser } from '../auth/auth.types';
import { BillingService } from './billing.service';
import { CreateCheckoutDto, VerifyCheckoutDto } from './dto/billing.dto';
import { Request } from 'express';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('checkout')
  async checkout(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCheckoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.billing.createCheckout(user.id, user.email, dto, idempotencyKey);
  }

  @Post('checkout/verify')
  @HttpCode(HttpStatus.OK)
  async verify(@CurrentUser() user: RequestUser, @Body() dto: VerifyCheckoutDto) {
    return this.billing.verifyCheckout(user.id, dto.sessionId);
  }

  @Post('checkout/:id/simulate')
  @HttpCode(HttpStatus.OK)
  async simulate(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.billing.simulateSuccess(user.id, id);
  }

  @Get('history')
  history(@CurrentUser() user: RequestUser) {
    return this.billing.history(user.id);
  }

  @Get('invoices/:id')
  async invoice(@CurrentUser() user: RequestUser, @Param('id', ParseObjectIdPipe) id: string) {
    return { invoice: await this.billing.getInvoice(user.id, id) };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') stripeSignature?: string,
    @Headers('x-webhook-signature') fakeSignature?: string,
  ) {
    const raw = rawRequestBody(req);
    return this.billing.handleWebhook(provider, raw, stripeSignature ?? fakeSignature);
  }
}

function rawRequestBody(req: RawBodyRequest<Request>): Buffer {
  if (Buffer.isBuffer(req.rawBody)) {
    return req.rawBody;
  }
  if (typeof req.rawBody === 'string') {
    return Buffer.from(req.rawBody);
  }
  if (typeof req.body === 'string') {
    return Buffer.from(req.body);
  }
  return Buffer.from(JSON.stringify(req.body ?? {}));
}
