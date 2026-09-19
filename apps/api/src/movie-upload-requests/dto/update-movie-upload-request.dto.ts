import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { MOVIE_UPLOAD_REQUEST_STATUSES } from '@movie-server/shared';

export class UpdateMovieUploadRequestDto {
  @IsOptional()
  @IsIn(MOVIE_UPLOAD_REQUEST_STATUSES)
  status?: (typeof MOVIE_UPLOAD_REQUEST_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}
