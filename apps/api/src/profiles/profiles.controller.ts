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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { RequestUser } from '../auth/auth.types';
import { ErrorCode } from '@movie-server/shared';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SelectProfileDto } from './dto/select-profile.dto';
import { RemoveProfilePinDto, SetProfilePinDto } from './dto/profile-pin.dto';
import { ProfilesService } from './profiles.service';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser) {
    return { profiles: await this.profiles.list(user.id) };
  }

  @Post()
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateProfileDto) {
    return { profile: await this.profiles.create(user.id, dto) };
  }

  @Get('active')
  async active(@CurrentUser() user: RequestUser) {
    return { profile: await this.profiles.getActive(user.id, user.sessionId) };
  }

  @Get(':id')
  async get(@CurrentUser() user: RequestUser, @Param('id', ParseObjectIdPipe) id: string) {
    return { profile: await this.profiles.get(user.id, id) };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return { profile: await this.profiles.update(user.id, id, dto) };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: RequestUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.profiles.remove(user.id, id, user.sessionId);
  }

  @Post(':id/select')
  @HttpCode(HttpStatus.OK)
  async select(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SelectProfileDto,
  ) {
    return { profile: await this.profiles.select(user.id, id, user.sessionId, dto.pin) };
  }

  @Post(':id/pin')
  @HttpCode(HttpStatus.OK)
  async setPin(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SetProfilePinDto,
  ) {
    return { profile: await this.profiles.setPin(user.id, id, dto.pin, dto.currentPin) };
  }

  @Delete(':id/pin')
  async clearPin(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RemoveProfilePinDto,
  ) {
    return { profile: await this.profiles.clearPin(user.id, id, dto.currentPin) };
  }

  @Post(':id/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({
        error: ErrorCode.ValidationFailed,
        message: 'Avatar file is required.',
      });
    }
    return {
      profile: await this.profiles.setAvatar(user.id, id, {
        mimetype: file.mimetype,
        buffer: file.buffer,
        size: file.size,
      }),
    };
  }

  @Delete(':id/avatar')
  async deleteAvatar(@CurrentUser() user: RequestUser, @Param('id', ParseObjectIdPipe) id: string) {
    return { profile: await this.profiles.clearAvatar(user.id, id) };
  }
}
