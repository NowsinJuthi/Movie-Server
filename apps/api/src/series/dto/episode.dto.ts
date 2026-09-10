import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
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
  BULK_EPISODE_ACTIONS,
  BulkEpisodeAction,
  MOVIE_AVAILABILITIES,
  MovieAvailability,
} from '@movie-server/shared';
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

export class UpsertEpisodeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  episodeNumber!: number;

  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

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
  thumbnailUrl?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  runtimeMinutes!: number;

  @IsOptional()
  @IsDateString()
  airDate?: string | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsIn([...MOVIE_AVAILABILITIES])
  availability?: MovieAvailability;
}

export class UpdateEpisodeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  episodeNumber?: number;

  @IsOptional()
  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

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
  thumbnailUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  runtimeMinutes?: number;

  @IsOptional()
  @IsDateString()
  airDate?: string | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsIn([...MOVIE_AVAILABILITIES])
  availability?: MovieAvailability;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(86400)
  introStartSeconds?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(86400)
  introEndSeconds?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(86400)
  recapStartSeconds?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(86400)
  recapEndSeconds?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(86400)
  creditsStartSeconds?: number | null;
}

export class BatchEpisodesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => UpsertEpisodeDto)
  episodes!: UpsertEpisodeDto[];
}

export class BulkEpisodesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  ids!: string[];

  @IsIn([...BULK_EPISODE_ACTIONS])
  action!: BulkEpisodeAction;
}
