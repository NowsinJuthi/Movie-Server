import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { HOME_MEDIA_KINDS, HOME_ROW_KINDS } from '@movie-server/shared';
import { Trim } from '../../common/decorators/transform.decorators';

export class UpsertHomeHeroDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn([...HOME_MEDIA_KINDS])
  mediaKind?: 'movie' | 'series' | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Trim()
  @IsString()
  @MaxLength(32)
  mediaId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Trim()
  @IsString()
  @MaxLength(120)
  titleOverride?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  itemIds?: string[];
}

export class CreateHomeRowDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string;

  @IsIn([...HOME_ROW_KINDS])
  kind!: (typeof HOME_ROW_KINDS)[number];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Trim()
  @IsString()
  @MaxLength(40)
  genre?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsMongoId()
  collectionId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  itemIds?: string[];
}

export class UpdateHomeRowDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsIn([...HOME_ROW_KINDS])
  kind?: (typeof HOME_ROW_KINDS)[number];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Trim()
  @IsString()
  @MaxLength(40)
  genre?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsMongoId()
  collectionId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  itemIds?: string[];
}

export class ReorderHomeRowsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  ids!: string[];
}
