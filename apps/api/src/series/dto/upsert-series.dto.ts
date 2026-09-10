import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  MATURITY_LEVELS,
  MOVIE_AVAILABILITIES,
  MOVIE_CERTIFICATIONS,
  MOVIE_GENRES,
  MaturityLevel,
  MovieAvailability,
  MovieCertification,
  SERIES_STATUSES,
  SeriesStatus,
} from '@movie-server/shared';
import { sanitizePlainText } from '../../common/security/sanitize';
import { Trim } from '../../common/decorators/transform.decorators';
import { isSafeHttpUrl } from '../../movies/movie.util';
import { CastMemberDto } from '../../movies/dto/cast-member.dto';
import { MovieRatingsDto } from '../../movies/dto/movie-ratings.dto';

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
const trimStringArray = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? sanitizePlainText(item) : item))
    : value;

export class UpsertSeriesDto {
  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @Trim()
  @Transform(({ value }) =>
    value === '' || value == null ? null : typeof value === 'string' ? sanitizePlainText(value) : value,
  )
  @IsString()
  @MaxLength(200)
  originalTitle?: string | null;

  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(4)
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @Trim()
  @Transform(emptyToNull)
  @Validate(SafeHttpUrlConstraint)
  posterUrl?: string | null;

  @IsOptional()
  @Trim()
  @Transform(emptyToNull)
  @Validate(SafeHttpUrlConstraint)
  backdropUrl?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1888)
  @Max(2100)
  firstAirYear!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1888)
  @Max(2100)
  lastAirYear?: number | null;

  @IsArray()
  @ArrayMaxSize(12)
  @IsIn([...MOVIE_GENRES], { each: true })
  genres!: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @Transform(trimStringArray)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => CastMemberDto)
  cast?: CastMemberDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @Transform(trimStringArray)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  directors?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => MovieRatingsDto)
  ratings?: MovieRatingsDto;

  @IsIn([...MATURITY_LEVELS])
  maturityRating!: MaturityLevel;

  @IsOptional()
  @Transform(emptyToNull)
  @IsIn([...MOVIE_CERTIFICATIONS])
  certification?: MovieCertification | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsMongoId()
  collectionId?: string | null;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  trending?: boolean;

  @IsOptional()
  @IsBoolean()
  popular?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsIn([...MOVIE_AVAILABILITIES])
  availability?: MovieAvailability;

  @IsOptional()
  @IsIn([...SERIES_STATUSES])
  status?: SeriesStatus;

  @IsOptional()
  @IsBoolean()
  autoPlayNext?: boolean;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;
}

export class UpdateSeriesDto {
  @IsOptional()
  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Trim()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200)
  originalTitle?: string | null;

  @IsOptional()
  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(4)
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @Trim()
  @Transform(emptyToNull)
  @Validate(SafeHttpUrlConstraint)
  posterUrl?: string | null;

  @IsOptional()
  @Trim()
  @Transform(emptyToNull)
  @Validate(SafeHttpUrlConstraint)
  backdropUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1888)
  @Max(2100)
  firstAirYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1888)
  @Max(2100)
  lastAirYear?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsIn([...MOVIE_GENRES], { each: true })
  genres?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @Transform(trimStringArray)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CastMemberDto)
  cast?: CastMemberDto[];

  @IsOptional()
  @IsArray()
  @Transform(trimStringArray)
  @IsString({ each: true })
  directors?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => MovieRatingsDto)
  ratings?: MovieRatingsDto;

  @IsOptional()
  @IsIn([...MATURITY_LEVELS])
  maturityRating?: MaturityLevel;

  @IsOptional()
  @Transform(emptyToNull)
  @IsIn([...MOVIE_CERTIFICATIONS])
  certification?: MovieCertification | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsMongoId()
  collectionId?: string | null;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  trending?: boolean;

  @IsOptional()
  @IsBoolean()
  popular?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsIn([...MOVIE_AVAILABILITIES])
  availability?: MovieAvailability;

  @IsOptional()
  @IsIn([...SERIES_STATUSES])
  status?: SeriesStatus;

  @IsOptional()
  @IsBoolean()
  autoPlayNext?: boolean;
}
