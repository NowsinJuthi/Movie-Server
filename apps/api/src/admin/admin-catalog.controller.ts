import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CatalogTermKind, UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CatalogService } from './catalog.service';
import { UpsertCatalogTermDto, UpdateCatalogTermDto } from './dto/catalog-term.dto';

@Controller('admin/catalog')
@Roles(UserRole.Admin)
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('genres')
  genres(@Query('q') q?: string) {
    return this.catalog.list(CatalogTermKind.Genre, q).then((items) => ({ items }));
  }

  @Post('genres')
  createGenre(@Body() dto: UpsertCatalogTermDto) {
    return this.catalog.create(CatalogTermKind.Genre, dto).then((item) => ({ item }));
  }

  @Patch('genres/:id')
  updateGenre(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateCatalogTermDto) {
    return this.catalog.update(CatalogTermKind.Genre, id, dto).then((item) => ({ item }));
  }

  @Delete('genres/:id')
  removeGenre(@Param('id', ParseObjectIdPipe) id: string) {
    return this.catalog.remove(CatalogTermKind.Genre, id);
  }

  @Get('tags')
  tags(@Query('q') q?: string) {
    return this.catalog.list(CatalogTermKind.Tag, q).then((items) => ({ items }));
  }

  @Post('tags')
  createTag(@Body() dto: UpsertCatalogTermDto) {
    return this.catalog.create(CatalogTermKind.Tag, dto).then((item) => ({ item }));
  }

  @Patch('tags/:id')
  updateTag(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateCatalogTermDto) {
    return this.catalog.update(CatalogTermKind.Tag, id, dto).then((item) => ({ item }));
  }

  @Delete('tags/:id')
  removeTag(@Param('id', ParseObjectIdPipe) id: string) {
    return this.catalog.remove(CatalogTermKind.Tag, id);
  }
}
