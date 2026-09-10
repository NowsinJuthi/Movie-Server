import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
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

const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);
const sanitize = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? sanitizePlainText(value) : value;

export class UpsertSeasonDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  seasonNumber!: number;

  @IsOptional()
  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Trim()
  @Transform(sanitize)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Trim()
  @Transform(emptyToNull)
  @Validate(SafeHttpUrlConstraint)
  posterUrl?: string | null;

  @IsOptional()
  @IsDateString()
  airDate?: string | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class UpdateSeasonDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  seasonNumber?: number;

  @IsOptional()
  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Trim()
  @Transform(sanitize)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Trim()
  @Transform(emptyToNull)
  @Validate(SafeHttpUrlConstraint)
  posterUrl?: string | null;

  @IsOptional()
  @IsDateString()
  airDate?: string | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
