import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import {
  MEDIA_REACTIONS,
  PERSONALIZATION_MEDIA_KINDS,
  PersonalizationMediaKind,
  USER_RATING_MAX,
  USER_RATING_MIN,
} from '@movie-server/shared';

export class UpsertWatchHistoryDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,64}$/)
  mediaId!: string;

  @IsInt()
  @Min(0)
  progressSeconds!: number;

  @IsInt()
  @Min(1)
  @Max(86400)
  durationSeconds!: number;
}

export class AddToListDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,64}$/)
  mediaId!: string;

  @IsOptional()
  @IsIn([...PERSONALIZATION_MEDIA_KINDS])
  kind?: PersonalizationMediaKind;
}

export class UpsertReactionDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,64}$/)
  mediaId!: string;

  @IsIn([...PERSONALIZATION_MEDIA_KINDS])
  kind!: PersonalizationMediaKind;

  @IsOptional()
  @IsIn([...MEDIA_REACTIONS, 'none'])
  reaction?: 'like' | 'dislike' | 'none';
}

export class UpsertRatingDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,64}$/)
  mediaId!: string;

  @IsIn([...PERSONALIZATION_MEDIA_KINDS])
  kind!: PersonalizationMediaKind;

  @Type(() => Number)
  @IsInt()
  @Min(USER_RATING_MIN)
  @Max(USER_RATING_MAX)
  rating!: number;
}
