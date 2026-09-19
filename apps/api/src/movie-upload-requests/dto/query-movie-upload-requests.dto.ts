import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CONTENT_UPLOAD_REQUEST_KINDS, MOVIE_UPLOAD_REQUEST_STATUSES } from '@movie-server/shared';

export class QueryMovieUploadRequestsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(MOVIE_UPLOAD_REQUEST_STATUSES)
  status?: (typeof MOVIE_UPLOAD_REQUEST_STATUSES)[number];

  @IsOptional()
  @IsIn(CONTENT_UPLOAD_REQUEST_KINDS)
  kind?: (typeof CONTENT_UPLOAD_REQUEST_KINDS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}
