import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  IsIn,
} from 'class-validator';
import { sanitizePlainText } from '../../common/security/sanitize';
import { Trim } from '../../common/decorators/transform.decorators';
import { isSafeHttpUrl } from '../../movies/movie.util';

@ValidatorConstraint({ name: 'safeHttpUrl', async: false })
class SafeHttpUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return value == null || value === '' || (typeof value === 'string' && isSafeHttpUrl(value));
  }

  defaultMessage(): string {
    return 'URL must be http(s) and must not be a filesystem path.';
  }
}

export class UpsertSeriesCollectionDto {
  @Trim()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizePlainText(value) : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(800)
  description?: string;

  @IsOptional()
  @Trim()
  @Transform(({ value }) => (value === '' ? null : value))
  @Validate(SafeHttpUrlConstraint)
  posterUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

export class UpdateSeriesCollectionDto {
  @IsOptional()
  @Trim()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizePlainText(value) : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(800)
  description?: string;

  @IsOptional()
  @Trim()
  @Transform(({ value }) => (value === '' ? null : value))
  @Validate(SafeHttpUrlConstraint)
  posterUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

export class ArtworkSlotDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsIn(['poster', 'backdrop', 'thumbnail'])
  slot?: 'poster' | 'backdrop' | 'thumbnail';
}
