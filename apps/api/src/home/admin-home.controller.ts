import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ErrorCode, UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { HomeCmsService } from './home-cms.service';
import { LibraryService } from '../library/library.service';
import {
  UpsertHomeHeroDto,
  CreateHomeRowDto,
  UpdateHomeRowDto,
  ReorderHomeRowsDto,
} from './dto/home-cms.dto';

@Controller('admin/home')
@Roles(UserRole.Admin)
export class AdminHomeController {
  constructor(
    private readonly cms: HomeCmsService,
    private readonly libraries: LibraryService,
  ) {}

  @Get('hero')
  async hero() {
    return { hero: this.cms.toPublicHero(await this.cms.getHero()) };
  }

  @Patch('hero')
  async updateHero(@Body() dto: UpsertHomeHeroDto) {
    const hero = await this.cms.updateHero(dto);
    return { hero: this.cms.toPublicHero(hero) };
  }

  @Get('rows')
  async rows() {
    const rows = await this.cms.listRows();
    return { rows: rows.map((row) => this.cms.toPublicRow(row)) };
  }

  @Post('rows')
  async createRow(@Body() dto: CreateHomeRowDto) {
    const row = await this.cms.createRow(dto);
    return { row: this.cms.toPublicRow(row) };
  }

  @Post('rows/reorder')
  async reorderRows(@Body() dto: ReorderHomeRowsDto) {
    const rows = await this.cms.reorderRows(dto.ids);
    return { rows: rows.map((row) => this.cms.toPublicRow(row)) };
  }

  @Post('rows/seed-catalog')
  async seedCatalogRows() {
    const rows = await this.cms.seedCatalogRows();
    return { rows: rows.map((row) => this.cms.toPublicRow(row)) };
  }

  @Post('rows/seed-libraries')
  async seedLibraryRows() {
    const { libraries } = await this.libraries.list();
    const rows = await this.cms.seedLibraryRows(
      libraries.map((library) => ({
        id: library.id,
        name: library.name,
        enabled: library.enabled,
      })),
    );
    return { rows: rows.map((row) => this.cms.toPublicRow(row)) };
  }

  @Patch('rows/:id')
  async updateRow(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateHomeRowDto) {
    const row = await this.cms.updateRow(id, dto);
    if (!row) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Home row not found.' });
    }
    return { row: this.cms.toPublicRow(row) };
  }

  @Delete('rows/:id')
  async removeRow(@Param('id', ParseObjectIdPipe) id: string) {
    const deleted = await this.cms.removeRow(id);
    if (!deleted) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Home row not found.' });
    }
    return { deleted: true };
  }
}
