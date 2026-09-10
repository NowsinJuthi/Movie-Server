import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CollectionsService } from './collections.service';
import { UpdateCollectionDto, UpsertCollectionDto } from './dto/collection.dto';
import { toPublicCollection } from './movie.mapper';

@Controller('admin/collections')
@Roles(UserRole.Admin)
export class AdminCollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  async list() {
    const collections = await this.collections.listAll();
    const counts = await this.collections.publishedCounts({});
    return { collections: await this.collections.toPublicList(collections, counts) };
  }

  @Post()
  async create(@Body() dto: UpsertCollectionDto) {
    const collection = await this.collections.create(dto);
    return { collection: toPublicCollection(collection, 0) };
  }

  @Patch(':id')
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateCollectionDto) {
    const collection = await this.collections.update(id, dto);
    return { collection: toPublicCollection(collection) };
  }

  @Delete(':id')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    await this.collections.remove(id);
    return { deleted: true };
  }
}
