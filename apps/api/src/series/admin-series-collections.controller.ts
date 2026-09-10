import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { SeriesService } from './series.service';
import { UpdateSeriesCollectionDto, UpsertSeriesCollectionDto } from './dto/collection.dto';
import { toPublicCollection } from './series.mapper';

@Controller('admin/series-collections')
@Roles(UserRole.Admin)
export class AdminSeriesCollectionsController {
  constructor(private readonly series: SeriesService) {}

  @Get()
  async list() {
    return { collections: await this.series.listCollectionsAdmin() };
  }

  @Post()
  async create(@Body() dto: UpsertSeriesCollectionDto) {
    const collection = await this.series.createCollection(dto);
    return { collection: toPublicCollection(collection, 0) };
  }

  @Patch(':id')
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateSeriesCollectionDto) {
    const collection = await this.series.updateCollection(id, dto);
    return { collection: toPublicCollection(collection) };
  }

  @Delete(':id')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    await this.series.removeCollection(id);
    return { deleted: true };
  }
}
