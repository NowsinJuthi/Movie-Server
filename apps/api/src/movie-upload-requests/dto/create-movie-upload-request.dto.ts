import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CONTENT_UPLOAD_REQUEST_KINDS } from '@movie-server/shared';

export class CreateMovieUploadRequestDto {
  @IsOptional()
  @IsIn(CONTENT_UPLOAD_REQUEST_KINDS)
  kind?: (typeof CONTENT_UPLOAD_REQUEST_KINDS)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1888)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsString()
  profileId?: string;
}
