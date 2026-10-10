import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RECOMMENDED_REGISTRATION_EMAIL_DOMAINS, UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { SmtpTestDto, UpdateSiteSettingsDto } from './dto/update-site-settings.dto';
import { SiteSettingsService } from './site-settings.service';

@Controller('admin/settings')
@Roles(UserRole.Admin)
export class AdminSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  async get() {
    return { settings: await this.settings.getAdminSettings() };
  }

  @Put()
  async update(@Body() dto: UpdateSiteSettingsDto) {
    return { settings: await this.settings.updateSettings(dto) };
  }

  @Post('logo/light')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadLogoLight(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return {
      settings: await this.settings.uploadLogoLight({
        mimetype: file.mimetype,
        buffer: file.buffer,
      }),
    };
  }

  @Post('logo/dark')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadLogoDark(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return {
      settings: await this.settings.uploadLogoDark({
        mimetype: file.mimetype,
        buffer: file.buffer,
      }),
    };
  }

  @Post('logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadLogo(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return {
      settings: await this.settings.uploadLogo({
        mimetype: file.mimetype,
        buffer: file.buffer,
      }),
    };
  }

  @Post('favicon')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadFavicon(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return {
      settings: await this.settings.uploadFavicon({
        mimetype: file.mimetype,
        buffer: file.buffer,
      }),
    };
  }

  @Delete('logo/light')
  async clearLogoLight() {
    return { settings: await this.settings.clearLogoLight() };
  }

  @Delete('logo/dark')
  async clearLogoDark() {
    return { settings: await this.settings.clearLogoDark() };
  }

  @Delete('logo')
  async clearLogo() {
    return { settings: await this.settings.clearLogo() };
  }

  @Delete('favicon')
  async clearFavicon() {
    return { settings: await this.settings.clearFavicon() };
  }

  @Post('smtp/test')
  async testSmtp(@Body() dto: SmtpTestDto) {
    return this.settings.testSmtp(dto.to);
  }

  @Get('recommended-email-domains')
  recommendedEmailDomains() {
    return { domains: [...RECOMMENDED_REGISTRATION_EMAIL_DOMAINS] };
  }
}
