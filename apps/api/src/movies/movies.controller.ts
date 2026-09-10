import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req } from '@nestjs/common';
import { PlanFeature } from '@movie-server/shared';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/auth.types';
import { RequireFeature, RequireSubscription } from '../subscriptions/decorators/subscription.decorators';
import { QueryMoviesDto } from './dto/query-movies.dto';
import { MoviesService } from './movies.service';
import { StartPlaybackDto, PlaybackProgressDto } from '../stream/dto/playback.dto';

@Controller('movies')
@RequireSubscription()
@RequireFeature(PlanFeature.Catalog)
export class MoviesController {
  constructor(private readonly movies: MoviesService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser, @Query() query: QueryMoviesDto, @Req() req: Request) {
    const viewer = await this.movies.resolveViewer(user);
    return this.movies.list(query, {
      admin: false,
      ...viewer,
      entitlement: req.entitlement,
    });
  }

  @Get('catalog')
  async catalog(@CurrentUser() user: RequestUser, @Req() req: Request) {
    const viewer = await this.movies.resolveViewer(user);
    return this.movies.catalog(viewer, req.entitlement);
  }

  @Get('continue-watching')
  async continueWatching(@CurrentUser() user: RequestUser) {
    return this.movies.continueWatching(user);
  }

  @Get(':id')
  async one(@CurrentUser() user: RequestUser, @Param('id') id: string, @Req() req: Request) {
    const viewer = await this.movies.resolveViewer(user);
    return this.movies.getForUser(id, user, viewer, req.entitlement);
  }

  @Post(':id/watched')
  @HttpCode(HttpStatus.OK)
  async markWatched(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.movies.setWatched(id, user, true);
  }

  @Delete(':id/watched')
  async markUnwatched(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.movies.setWatched(id, user, false);
  }

  @Post(':id/playback')
  @HttpCode(HttpStatus.OK)
  async playback(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: StartPlaybackDto,
  ) {
    return this.movies.playback(id, user, dto.quality, {
      currentStreamCount: dto.currentStreamCount,
      deviceId: dto.deviceId,
      deviceLabel: dto.deviceLabel,
    });
  }

  @Put(':id/progress')
  async progress(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: PlaybackProgressDto,
  ) {
    return this.movies.saveProgress(id, user, dto);
  }
}
