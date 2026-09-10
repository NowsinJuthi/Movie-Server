import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  MATURITY_LEVELS,
  MaturityLevel,
  PRESET_AVATARS,
  PROFILE_LANGUAGES,
  SUBTITLE_LANGUAGES,
} from '@movie-server/shared';
import { sanitizePlainText } from '../../common/security/sanitize';
import { Trim } from '../../common/decorators/transform.decorators';

export class CreateProfileDto {
  @Trim()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizePlainText(value) : value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  name!: string;

  @IsOptional()
  @IsIn([...PRESET_AVATARS])
  avatarKey?: string;

  @IsOptional()
  @IsBoolean()
  isKids?: boolean;

  @IsOptional()
  @IsIn([...PROFILE_LANGUAGES])
  language?: string;

  @IsOptional()
  @IsIn([...PROFILE_LANGUAGES])
  audioLanguage?: string;

  @IsOptional()
  @IsIn([...SUBTITLE_LANGUAGES])
  subtitleLanguage?: string;

  @IsOptional()
  @IsIn([...MATURITY_LEVELS])
  maturityLevel?: MaturityLevel;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be a 4-digit code.' })
  pin?: string;
}
