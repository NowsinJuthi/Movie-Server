import { Controller, Get, Query } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { MediaKind, UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { MoviesService } from './movies.service';
import { AdminPageQueryDto } from '../admin/dto/admin-page-query.dto';

class QueryTracksDto extends AdminPageQueryDto {
  @IsOptional()
  @IsIn([MediaKind.Audio, MediaKind.Subtitle])
  kind?: MediaKind;
}

@Controller('admin/tracks')
@Roles(UserRole.Admin)
export class AdminTracksController {
  constructor(private readonly movies: MoviesService) {}

  @Get()
  list(@Query() query: QueryTracksDto) {
    return this.movies.listTracks(query);
  }
}
