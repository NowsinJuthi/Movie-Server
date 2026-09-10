import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MOVIE_GENRES, MOVIE_SORTS, MovieSort } from '@movie-server/shared';
import { Trim } from '../../common/decorators/transform.decorators';

function toBool({ value }: { value: unknown }): boolean | undefined {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}

export class QueryMoviesDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  q?: string;

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
  @IsMongoId()
  collection?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  trending?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  popular?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsIn([...MOVIE_SORTS])
  sort?: MovieSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
