import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminJobsService } from './admin-jobs.service';

const queueEnabled = process.env.NODE_ENV !== 'test' && process.env.REDIS_HOST !== 'memory';

@Controller('admin')
@Roles(UserRole.Admin)
export class AdminDashboardController {
  constructor(
    private readonly dashboard: AdminDashboardService,
    private readonly jobs: AdminJobsService,
  ) {}

  @Get('dashboard')
  stats() {
    return this.dashboard.dashboard();
  }

  @Get('health')
  health() {
    return this.dashboard.health(queueEnabled);
  }

  @Get('jobs')
  listJobs() {
    return this.jobs.list();
  }
}
