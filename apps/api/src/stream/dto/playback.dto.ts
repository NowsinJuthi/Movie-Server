import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { VIDEO_QUALITIES, VideoQuality } from '@movie-server/shared';
import { Trim } from '../../common/decorators/transform.decorators';

export class StartPlaybackDto {
  @IsIn([...VIDEO_QUALITIES])
  quality!: VideoQuality;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  currentStreamCount?: number;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  deviceId?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  deviceLabel?: string;
}

export class PlaybackProgressDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(86400)
  progressSeconds!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86400)
  durationSeconds!: number;
}
