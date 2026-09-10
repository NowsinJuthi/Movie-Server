import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { AdminPageQueryDto } from './dto/admin-page-query.dto';

@Controller('admin/audit')
@Roles(UserRole.Admin)
export class AdminAuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() query: AdminPageQueryDto) {
    return this.audit.list({
      q: query.q,
      actorUserId: query.userId,
      page: query.page,
      limit: query.limit,
    });
  }
}
