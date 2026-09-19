import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { ProfilesService } from './profiles.service';
import { AdminPageQueryDto, QueryProfileSuggestDto } from '../admin/dto/admin-page-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('admin/profiles')
@Roles(UserRole.Admin)
export class AdminProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('suggest')
  @Permissions('view_profiles')
  async suggest(@Query() query: QueryProfileSuggestDto) {
    const profiles = await this.profiles.suggestAdmin(query.q, query.limit);
    return { profiles };
  }

  @Get()
  @Permissions('view_profiles')
  list(@Query() query: AdminPageQueryDto) {
    return this.profiles.listAdmin(query);
  }

  @Patch(':id')
  @Permissions('manage_profiles')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateProfileDto) {
    return this.profiles.adminUpdate(id, dto);
  }

  @Delete(':id')
  @Permissions('manage_profiles')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.profiles.adminRemove(id);
  }
}

