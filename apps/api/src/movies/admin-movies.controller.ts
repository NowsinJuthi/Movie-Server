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
import { ErrorCode, UserRole } from '@movie-server/shared';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { MoviesService } from './movies.service';
import { QueryMoviesDto } from './dto/query-movies.dto';
import { UpdateMovieDto, UpsertMovieDto } from './dto/upsert-movie.dto';
import { BulkMoviesDto } from './dto/bulk-movies.dto';
import { CreateMediaAssetDto, UpdateMediaAssetDto } from './dto/media-asset.dto';
import { ArtworkSlotDto } from './dto/artwork.dto';
import { toAdminMediaAsset, toPublicMovie } from './movie.mapper';

@Controller('admin/movies')
@Roles(UserRole.Admin)
export class AdminMoviesController {
  constructor(private readonly movies: MoviesService) {}

  @Get()
  async list(@Query() query: QueryMoviesDto) {
    return this.movies.list(query, { admin: true });
  }

  @Post()
  async create(@Body() dto: UpsertMovieDto) {
    const movie = await this.movies.create(dto);
    return { movie: toPublicMovie(movie, { admin: true }) };
  }

  @Post('bulk')
  async bulk(@Body() dto: BulkMoviesDto) {
    const result = await this.movies.bulk(dto.ids, dto.action);
    return { ...result, action: dto.action };
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    return this.movies.getForAdmin(id);
  }

  @Patch(':id')
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateMovieDto) {
    const movie = await this.movies.update(id, dto);
    return { movie: toPublicMovie(movie, { admin: true }) };
  }

  @Delete(':id')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    await this.movies.remove(id);
    return { deleted: true };
  }

  @Post(':id/artwork')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
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
    const movie = await this.movies.attachArtwork(id, body.slot ?? 'poster', {
      mimetype: file.mimetype,
      buffer: file.buffer,
      size: file.size,
    });
    return { movie: toPublicMovie(movie, { admin: true }) };
  }

  @Post(':id/media')
  async addMedia(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: CreateMediaAssetDto) {
    const asset = await this.movies.addMedia(id, dto);
    return { asset: toAdminMediaAsset(asset) };
  }

  @Patch(':id/media/:assetId')
  async updateMedia(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('assetId', ParseObjectIdPipe) assetId: string,
    @Body() dto: UpdateMediaAssetDto,
  ) {
    const asset = await this.movies.updateMedia(id, assetId, dto);
    return { asset: toAdminMediaAsset(asset) };
  }

  @Delete(':id/media/:assetId')
  async removeMedia(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('assetId', ParseObjectIdPipe) assetId: string,
  ) {
    await this.movies.removeMedia(id, assetId);
    return { deleted: true };
  }
}
