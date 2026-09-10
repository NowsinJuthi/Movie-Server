import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { ProfilesService } from './profiles.service';
import { AdminPageQueryDto } from '../admin/dto/admin-page-query.dto';

@Controller('admin/profiles')
@Roles(UserRole.Admin)
export class AdminProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  list(@Query() query: AdminPageQueryDto) {
    return this.profiles.listAdmin(query);
  }

  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.profiles.adminRemove(id);
  }
}
