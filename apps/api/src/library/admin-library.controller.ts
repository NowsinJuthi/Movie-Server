import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ErrorCode, UserRole } from '@movie-server/shared';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { LibraryService } from './library.service';
import { LibraryScanService } from './library-scan.service';
import { UpdateLibraryDto, UpsertLibraryDto } from './dto/upsert-library.dto';
import { QueryLibraryItemsDto } from './dto/query-library-items.dto';
import { StartScanDto } from './dto/start-scan.dto';

@Controller('admin/libraries')
@Roles(UserRole.Admin)
export class AdminLibraryController {
  constructor(private readonly libraries: LibraryService) {}

  @Get()
  list() {
    return this.libraries.list();
  }

  @Post()
  @Permissions('manage_libraries')
  create(@Body() dto: UpsertLibraryDto) {
    return this.libraries.create(dto);
  }

  @Get(':id/items')
  items(@Param('id', ParseObjectIdPipe) id: string, @Query() query: QueryLibraryItemsDto) {
    return this.libraries.listItems(id, query);
  }

  @Get(':id')
  one(@Param('id', ParseObjectIdPipe) id: string) {
    return this.libraries.one(id);
  }

  @Patch(':id')
  @Permissions('manage_libraries')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateLibraryDto) {
    return this.libraries.update(id, dto);
  }

  @Post(':id/image')
  @Permissions('manage_libraries')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Image file is required.',
      });
    }
    return this.libraries.attachImage(id, {
      mimetype: file.mimetype,
      buffer: file.buffer,
      size: file.size,
    });
  }

  @Delete(':id')
  @Permissions('manage_libraries')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.libraries.remove(id);
  }
}

@Controller('admin/libraries/scans')
@Roles(UserRole.Admin)
export class AdminLibraryScanController {
  constructor(private readonly scans: LibraryScanService) {}

  @Get()
  list() {
    return this.scans.listScans();
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Permissions('manage_libraries')
  start(@Body() dto: StartScanDto) {
    return this.scans.start(dto ?? {});
  }

  @Get(':id/logs')
  logs(@Param('id', ParseObjectIdPipe) id: string) {
    return this.scans.logsFor(id);
  }

  @Post(':id/cancel')
  @Permissions('manage_libraries')
  cancel(@Param('id', ParseObjectIdPipe) id: string) {
    return this.scans.cancel(id);
  }

  @Get(':id')
  one(@Param('id', ParseObjectIdPipe) id: string) {
    return this.scans.oneScan(id);
  }
}
