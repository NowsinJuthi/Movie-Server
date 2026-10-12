import { Body, Controller, Get, Param, Patch, Put, Query } from '@nestjs/common';
import { UserRole } from '@movie-server/shared';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { SiteSettingsService } from '../settings/site-settings.service';
import { QueryMovieUploadRequestsDto } from './dto/query-movie-upload-requests.dto';
import { UpdateMovieUploadRequestDto } from './dto/update-movie-upload-request.dto';
import { MovieUploadRequestFeatureDto } from './dto/movie-upload-request-feature.dto';
import { MovieUploadRequestsService } from './movie-upload-requests.service';

@Controller('admin/movie-upload-requests')
@Roles(UserRole.Admin)
export class AdminMovieUploadRequestsController {
  constructor(
    private readonly requests: MovieUploadRequestsService,
    private readonly settings: SiteSettingsService,
  ) {}

  @Get()
  @Permissions('view_movies')
  list(@Query() query: QueryMovieUploadRequestsDto) {
    return this.requests.adminList(query);
  }

  @Patch(':id')
  @Permissions('manage_movies')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateMovieUploadRequestDto) {
    return this.requests.adminUpdate(id, dto);
  }

  @Get('feature')
  @Permissions('manage_home_curation')
  async feature() {
    const settings = await this.settings.getAdminSettings();
    return { enabled: settings.movieUploadRequestsEnabled };
  }

  @Put('feature')
  @Permissions('manage_home_curation')
  async setFeature(@Body() dto: MovieUploadRequestFeatureDto) {
    const settings = await this.settings.updateSettings({
      movieUploadRequestsEnabled: Boolean(dto.enabled),
    });
    return { enabled: settings.movieUploadRequestsEnabled };
  }
}
