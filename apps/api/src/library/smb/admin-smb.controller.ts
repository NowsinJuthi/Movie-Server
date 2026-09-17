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
import { Permissions, PermissionsAny } from '../../common/decorators/permissions.decorator';
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
  @PermissionsAny('upload_smb_files', 'manage_smb_files')
  list() {
    return this.smb.list();
  }

  @Post()
  @Permissions('manage_smb_files')
  create(@Body() dto: UpsertSmbServerDto) {
    return this.smb.create(dto);
  }

  @Post('libraries')
  @Permissions('manage_smb_files')
  addLibrary(@Body() dto: AddSmbLibraryDto) {
    return this.smb.addLibrary(dto);
  }

  @Post(':id/credentials')
  @PermissionsAny('upload_smb_files', 'manage_smb_files')
  updateCredentials(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateSmbCredentialsDto,
  ) {
    return this.smb.updateCredentials(id, dto.password);
  }

  @Post(':id/upload')
  @PermissionsAny('upload_smb_files', 'manage_smb_files')
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
  @Permissions('manage_smb_files')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateSmbServerDto) {
    return this.smb.update(id, dto);
  }

  @Delete(':id')
  @Permissions('manage_smb_files')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.smb.remove(id);
  }

  @Post(':id/test')
  @PermissionsAny('upload_smb_files', 'manage_smb_files')
  test(@Param('id', ParseObjectIdPipe) id: string) {
    return this.smb.test(id);
  }

  @Get(':id/browse')
  @PermissionsAny('upload_smb_files', 'manage_smb_files')
  browse(@Param('id', ParseObjectIdPipe) id: string, @Query() query: BrowseSmbDto) {
    return this.smb.browse(id, query.path ?? '');
  }
}
