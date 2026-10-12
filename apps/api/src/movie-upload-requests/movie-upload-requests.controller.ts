import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { CreateMovieUploadRequestDto } from './dto/create-movie-upload-request.dto';
import { MovieUploadRequestsService } from './movie-upload-requests.service';

@Controller('movie-upload-requests')
export class MovieUploadRequestsController {
  constructor(private readonly requests: MovieUploadRequestsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateMovieUploadRequestDto) {
    return this.requests.create(user, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() user: RequestUser) {
    return this.requests.listMine(user);
  }
}
