import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Public()
  @Get()
  async list() {
    const plans = await this.plans.listActive();
    return { plans: plans.map((plan) => this.plans.toPublic(plan)) };
  }
}
