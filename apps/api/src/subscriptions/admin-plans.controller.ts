import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { PlansService } from './plans.service';
import { AdminUpdatePlanDto, AdminUpsertPlanDto } from './dto/admin-plan.dto';

@Controller('admin/plans')
@Roles(UserRole.Admin)
export class AdminPlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  async list() {
    const plans = await this.plans.listAll();
    return { plans: plans.map((plan) => this.plans.toPublic(plan)) };
  }

  @Post()
  async create(@Body() dto: AdminUpsertPlanDto) {
    const plan = await this.plans.create(dto);
    return { plan: this.plans.toPublic(plan) };
  }

  @Patch(':id')
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: AdminUpdatePlanDto) {
    const plan = await this.plans.update(id, dto);
    return { plan: this.plans.toPublic(plan) };
  }

  @Delete(':id')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    const plan = await this.plans.deactivate(id);
    return { plan: this.plans.toPublic(plan), message: 'Plan disabled for new signups.' };
  }
}
