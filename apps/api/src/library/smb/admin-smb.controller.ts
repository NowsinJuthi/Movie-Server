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
import { diskStorage } from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomBytes } from 'crypto';
import { ErrorCode, UserRole } from '@movie-server/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { SmbService } from './smb.service';
import {
  AddSmbLibraryDto,
  BrowseSmbDto,
  UpdateSmbCredentialsDto,
  UpdateSmbServerDto,
  UploadSmbMediaDto,
  UpsertSmbServerDto,
} from './dto/smb.dto';

const SMB_UPLOAD_MAX_BYTES = 50 * 1024 * 1024 * 1024;
const uploadTempRoot = path.join(os.tmpdir(), 'amarpin-smb-uploads');
if (!fs.existsSync(uploadTempRoot)) {
  fs.mkdirSync(uploadTempRoot, { recursive: true });
}

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

  @Post(':id/credentials')
  updateCredentials(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateSmbCredentialsDto,
  ) {
    return this.smb.updateCredentials(id, dto.password);
  }

  @Post(':id/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadTempRoot,
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).slice(0, 16);
          cb(null, `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`);
        },
      }),
      limits: { fileSize: SMB_UPLOAD_MAX_BYTES },
    }),
  )
  upload(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() query: UploadSmbMediaDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Video file is required.',
      });
    }
    return this.smb.uploadMedia(id, query.path ?? '', file, { scan: query.scan });
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
