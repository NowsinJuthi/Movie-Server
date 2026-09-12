import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { ProfilesService } from './profiles.service';
import { AdminPageQueryDto, QueryProfileSuggestDto } from '../admin/dto/admin-page-query.dto';

@Controller('admin/profiles')
@Roles(UserRole.Admin)
export class AdminProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('suggest')
  async suggest(@Query() query: QueryProfileSuggestDto) {
    const profiles = await this.profiles.suggestAdmin(query.q, query.limit);
    return { profiles };
  }

  @Get()
  list(@Query() query: AdminPageQueryDto) {
    return this.profiles.listAdmin(query);
  }

  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.profiles.adminRemove(id);
  }
}
