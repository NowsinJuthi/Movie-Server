import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put, Post, Query, Req } from '@nestjs/common';
import { PlanFeature } from '@movie-server/shared';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/auth.types';
import { RequireFeature, RequireSubscription } from '../subscriptions/decorators/subscription.decorators';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { QuerySeriesDto } from './dto/query-series.dto';
import { EpisodePlaybackDto, EpisodeProgressDto } from './dto/progress.dto';
import { SeriesService } from './series.service';

@Controller('series')
@RequireSubscription()
@RequireFeature(PlanFeature.Catalog)
export class SeriesController {
  constructor(private readonly series: SeriesService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser, @Query() query: QuerySeriesDto) {
    const viewer = await this.series.resolveViewer(user);
    return this.series.list(query, { admin: false, ...viewer });
  }

  @Get('catalog')
  async catalog(@CurrentUser() user: RequestUser) {
    const viewer = await this.series.resolveViewer(user);
    return this.series.catalog(viewer);
  }

  @Get('continue-watching')
  async continueWatching(@CurrentUser() user: RequestUser) {
    return this.series.continueWatching(user);
  }

  @Get('collections')
  async collections(@CurrentUser() user: RequestUser) {
    const viewer = await this.series.resolveViewer(user);
    return { collections: await this.series.listPublicCollections(viewer) };
  }

  @Get(':id')
  async one(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const viewer = await this.series.resolveViewer(user);
    return this.series.getSeries(id, viewer, user, false);
  }

  @Get(':id/seasons/:seasonId')
  async season(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('seasonId', ParseObjectIdPipe) seasonId: string,
    @Req() req: Request,
  ) {
    const viewer = await this.series.resolveViewer(user);
    return this.series.getSeason(id, seasonId, viewer, user, req.entitlement, false);
  }

  @Get(':id/episodes/:episodeId')
  async episode(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('episodeId', ParseObjectIdPipe) episodeId: string,
    @Req() req: Request,
  ) {
    const viewer = await this.series.resolveViewer(user);
    return this.series.getEpisode(id, episodeId, viewer, user, req.entitlement, false);
  }

  @Put(':id/episodes/:episodeId/progress')
  async progress(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('episodeId', ParseObjectIdPipe) episodeId: string,
    @Body() dto: EpisodeProgressDto,
  ) {
    return this.series.saveProgress(id, episodeId, user, dto);
  }

  @Post(':id/episodes/:episodeId/watched')
  @HttpCode(HttpStatus.OK)
  async markWatched(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('episodeId', ParseObjectIdPipe) episodeId: string,
  ) {
    return this.series.setWatched(id, episodeId, user, true);
  }

  @Delete(':id/episodes/:episodeId/watched')
  async markUnwatched(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('episodeId', ParseObjectIdPipe) episodeId: string,
  ) {
    return this.series.setWatched(id, episodeId, user, false);
  }

  @Post(':id/episodes/:episodeId/playback')
  @HttpCode(HttpStatus.OK)
  async playback(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('episodeId', ParseObjectIdPipe) episodeId: string,
    @Body() dto: EpisodePlaybackDto,
    @Req() req: Request,
  ) {
    return this.series.playback(id, episodeId, user, dto.quality, {
      currentStreamCount: dto.currentStreamCount,
      deviceId: dto.deviceId,
      deviceLabel: req.get('user-agent') || dto.deviceLabel,
      hevcDirectStream: dto.hevcDirectStream,
      forceVideoTranscode: dto.forceVideoTranscode,
    });
  }
}
