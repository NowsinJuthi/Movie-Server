import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ErrorCode, MaturityLevel, UserRole } from '@movie-server/shared';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateMediaAssetDto, UpdateMediaAssetDto } from '../movies/dto/media-asset.dto';
import { toAdminMediaAsset } from '../movies/movie.mapper';
import { toPublicEpisode, toPublicSeason, toPublicSeries } from './series.mapper';
import { SeriesService } from './series.service';
import { QuerySeriesDto } from './dto/query-series.dto';
import { UpdateSeriesDto, UpsertSeriesDto } from './dto/upsert-series.dto';
import { BulkSeriesDto } from './dto/bulk-series.dto';
import { UpdateSeasonDto, UpsertSeasonDto } from './dto/season.dto';
import { BatchEpisodesDto, BulkEpisodesDto, UpdateEpisodeDto, UpsertEpisodeDto } from './dto/episode.dto';
import { ArtworkSlotDto } from './dto/collection.dto';

@Controller('admin/series')
@Roles(UserRole.Admin)
export class AdminSeriesController {
  constructor(private readonly series: SeriesService) {}

  @Get()
  list(@Query() query: QuerySeriesDto) {
    return this.series.list(query, { admin: true });
  }

  @Post()
  async create(@Body() dto: UpsertSeriesDto) {
    const created = await this.series.createSeries(dto);
    return { series: toPublicSeries(created) };
  }

  @Post('bulk')
  @Permissions('manage_series')
  async bulk(@Body() dto: BulkSeriesDto) {
    const result = await this.series.bulkSeries(dto.ids, dto.action);
    return { ...result, action: dto.action };
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    return this.series.getSeries(id, { maturity: MaturityLevel.Mature, isKids: false }, undefined, true);
  }

  @Patch(':id')
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateSeriesDto) {
    const updated = await this.series.updateSeries(id, dto);
    return { series: toPublicSeries(updated) };
  }

  @Delete(':id')
  @Permissions('manage_series')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    await this.series.removeSeries(id);
    return { deleted: true };
  }

  @Post(':id/artwork')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  async artwork(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() body: ArtworkSlotDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Artwork file is required.',
      });
    }
    const doc = await this.series.attachArtwork(
      { seriesId: id },
      body.slot === 'backdrop' ? 'backdrop' : 'poster',
      { mimetype: file.mimetype, buffer: file.buffer, size: file.size },
    );
    return { series: toPublicSeries(doc as never) };
  }

  @Post(':id/seasons')
  async createSeason(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpsertSeasonDto) {
    const season = await this.series.createSeason(id, dto);
    return { season: toPublicSeason(season) };
  }

  @Get(':id/seasons/:seasonId')
  async season(
    @Param('id') id: string,
    @Param('seasonId', ParseObjectIdPipe) seasonId: string,
  ) {
    return this.series.getSeason(id, seasonId, { maturity: MaturityLevel.Mature, isKids: false }, undefined, null, true);
  }

  @Patch(':id/seasons/:seasonId')
  async updateSeason(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('seasonId', ParseObjectIdPipe) seasonId: string,
    @Body() dto: UpdateSeasonDto,
  ) {
    const season = await this.series.updateSeason(id, seasonId, dto);
    return { season: toPublicSeason(season) };
  }

  @Delete(':id/seasons/:seasonId')
  async removeSeason(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('seasonId', ParseObjectIdPipe) seasonId: string,
  ) {
    await this.series.removeSeason(id, seasonId);
    return { deleted: true };
  }

  @Post(':id/seasons/:seasonId/episodes')
  async createEpisode(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('seasonId', ParseObjectIdPipe) seasonId: string,
    @Body() dto: UpsertEpisodeDto,
  ) {
    const episode = await this.series.createEpisode(id, seasonId, dto);
    return { episode: toPublicEpisode(episode, { admin: true }) };
  }

  @Post(':id/seasons/:seasonId/episodes/batch')
  async batchEpisodes(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('seasonId', ParseObjectIdPipe) seasonId: string,
    @Body() dto: BatchEpisodesDto,
  ) {
    const episodes = await this.series.createEpisodes(id, seasonId, dto.episodes);
    return { episodes: episodes.map((episode) => toPublicEpisode(episode, { admin: true })) };
  }

  @Post(':id/seasons/:seasonId/episodes/bulk')
  async bulkEpisodes(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('seasonId', ParseObjectIdPipe) seasonId: string,
    @Body() dto: BulkEpisodesDto,
  ) {
    const result = await this.series.bulkEpisodes(id, seasonId, dto.ids, dto.action);
    return { ...result, action: dto.action };
  }

  @Get(':id/seasons/:seasonId/episodes/:episodeId')
  async episode(
    @Param('id') id: string,
    @Param('seasonId') _seasonId: string,
    @Param('episodeId', ParseObjectIdPipe) episodeId: string,
  ) {
    return this.series.getEpisode(id, episodeId, { maturity: MaturityLevel.Mature, isKids: false }, undefined, null, true);
  }

  @Patch(':id/seasons/:seasonId/episodes/:episodeId')
  async updateEpisode(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('seasonId', ParseObjectIdPipe) seasonId: string,
    @Param('episodeId', ParseObjectIdPipe) episodeId: string,
    @Body() dto: UpdateEpisodeDto,
  ) {
    const episode = await this.series.updateEpisode(id, seasonId, episodeId, dto);
    return { episode: toPublicEpisode(episode, { admin: true }) };
  }

  @Delete(':id/seasons/:seasonId/episodes/:episodeId')
  async removeEpisode(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('seasonId', ParseObjectIdPipe) seasonId: string,
    @Param('episodeId', ParseObjectIdPipe) episodeId: string,
  ) {
    await this.series.removeEpisode(id, seasonId, episodeId);
    return { deleted: true };
  }

  @Post(':id/seasons/:seasonId/episodes/:episodeId/artwork')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  async episodeArtwork(
    @Param('episodeId', ParseObjectIdPipe) episodeId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Artwork file is required.',
      });
    }
    const episode = await this.series.attachArtwork({ episodeId }, 'thumbnail', {
      mimetype: file.mimetype,
      buffer: file.buffer,
      size: file.size,
    });
    return { episode: toPublicEpisode(episode as never, { admin: true }) };
  }

  @Post(':id/seasons/:seasonId/episodes/:episodeId/media')
  async addMedia(
    @Param('episodeId', ParseObjectIdPipe) episodeId: string,
    @Body() dto: CreateMediaAssetDto,
  ) {
    const asset = await this.series.addMedia(episodeId, dto);
    return { asset: toAdminMediaAsset(asset) };
  }

  @Patch(':id/seasons/:seasonId/episodes/:episodeId/media/:assetId')
  async updateMedia(
    @Param('episodeId', ParseObjectIdPipe) episodeId: string,
    @Param('assetId', ParseObjectIdPipe) assetId: string,
    @Body() dto: UpdateMediaAssetDto,
  ) {
    const asset = await this.series.updateMedia(episodeId, assetId, dto);
    return { asset: toAdminMediaAsset(asset) };
  }

  @Delete(':id/seasons/:seasonId/episodes/:episodeId/media/:assetId')
  async removeMedia(
    @Param('episodeId', ParseObjectIdPipe) episodeId: string,
    @Param('assetId', ParseObjectIdPipe) assetId: string,
  ) {
    await this.series.removeMedia(episodeId, assetId);
    return { deleted: true };
  }
}
