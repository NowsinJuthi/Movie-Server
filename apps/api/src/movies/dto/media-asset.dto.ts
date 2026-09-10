import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  MEDIA_ASSET_STATUSES,
  MEDIA_KINDS,
  MediaAssetStatus,
  MediaKind,
  SUBTITLE_FORMATS,
  VIDEO_RESOLUTIONS,
  VideoResolution,
  type SubtitleFormat,
} from '@movie-server/shared';
import { sanitizePlainText } from '../../common/security/sanitize';
import { Trim } from '../../common/decorators/transform.decorators';

export class CreateMediaAssetDto {
  @IsIn([...MEDIA_KINDS])
  kind!: MediaKind;

  @ValidateIf((dto: CreateMediaAssetDto) => dto.kind === MediaKind.Video)
  @IsIn([...VIDEO_RESOLUTIONS])
  quality?: VideoResolution;

  @IsOptional()
  @Trim()
  @Transform(({ value }) =>
    value === '' || value == null ? null : typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsString()
  @MaxLength(12)
  language?: string | null;

  @IsOptional()
  @Trim()
  @Transform(({ value }) =>
    value === '' || value == null
      ? null
      : typeof value === 'string'
        ? sanitizePlainText(value)
        : value,
  )
  @IsString()
  @MaxLength(80)
  label?: string | null;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(40)
  codec?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(16)
  channels?: number | null;

  @IsOptional()
  @IsIn([...SUBTITLE_FORMATS])
  format?: SubtitleFormat | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(200_000)
  bitrateKbps?: number | null;

  @IsOptional()
  @IsBoolean()
  forced?: boolean;

  @IsOptional()
  @IsBoolean()
  hearingImpaired?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  sortOrder?: number;

  @IsOptional()
  @IsIn([...MEDIA_ASSET_STATUSES])
  status?: MediaAssetStatus;
}

export class UpdateMediaAssetDto {
  @IsOptional()
  @IsIn([...VIDEO_RESOLUTIONS])
  quality?: VideoResolution | null;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(12)
  language?: string | null;

  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label?: string | null;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(40)
  codec?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(16)
  channels?: number | null;

  @IsOptional()
  @IsIn([...SUBTITLE_FORMATS])
  format?: SubtitleFormat | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(200_000)
  bitrateKbps?: number | null;

  @IsOptional()
  @IsBoolean()
  forced?: boolean;

  @IsOptional()
  @IsBoolean()
  hearingImpaired?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  sortOrder?: number;

  @IsOptional()
  @IsIn([...MEDIA_ASSET_STATUSES])
  status?: MediaAssetStatus;
}
