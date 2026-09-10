import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MOVIE_GENRES,
  PROFILE_LANGUAGES,
  SEARCH_KINDS,
  SEARCH_SORTS,
  SearchKind,
  SearchSort,
  VIDEO_RESOLUTIONS,
} from '@movie-server/shared';
import { Trim } from '../../common/decorators/transform.decorators';

function toBool({ value }: { value: unknown }): boolean | undefined {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}

export class QuerySearchDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn([...SEARCH_KINDS])
  kind?: SearchKind;

  @IsOptional()
  @IsIn([...MOVIE_GENRES])
  genre?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(40)
  tag?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1888)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1888)
  @Max(2100)
  yearFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1888)
  @Max(2100)
  yearTo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  minRating?: number;

  @IsOptional()
  @IsIn([...PROFILE_LANGUAGES])
  language?: string;

  @IsOptional()
  @IsIn([...PROFILE_LANGUAGES])
  audio?: string;

  @IsOptional()
  @IsIn([...VIDEO_RESOLUTIONS])
  quality?: string;

  @IsOptional()
  @IsIn([...SEARCH_SORTS])
  sort?: SearchSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit?: number;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  commit?: boolean;
}

export class QuerySuggestDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class RecordSearchDto {
  @Trim()
  @IsString()
  @MaxLength(120)
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  resultCount?: number;
}
