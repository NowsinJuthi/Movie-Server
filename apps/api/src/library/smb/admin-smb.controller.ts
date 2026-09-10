import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@movie-server/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { SmbService } from './smb.service';
import { AddSmbLibraryDto, BrowseSmbDto, UpdateSmbServerDto, UpsertSmbServerDto } from './dto/smb.dto';

@Controller('admin/smb-servers')
@Roles(UserRole.Admin)
export class AdminSmbController {
  constructor(private readonly smb: SmbService) {}

  @Get()
  list() {
    return this.smb.list();
  }

  @Post()
  create(@Body() dto: UpsertSmbServerDto) {
    return this.smb.create(dto);
  }

  @Post('libraries')
  addLibrary(@Body() dto: AddSmbLibraryDto) {
    return this.smb.addLibrary(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateSmbServerDto) {
    return this.smb.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.smb.remove(id);
  }

  @Post(':id/test')
  test(@Param('id', ParseObjectIdPipe) id: string) {
    return this.smb.test(id);
  }

  @Get(':id/browse')
  browse(@Param('id', ParseObjectIdPipe) id: string, @Query() query: BrowseSmbDto) {
    return this.smb.browse(id, query.path ?? '');
  }
}
