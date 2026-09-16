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
  MinLength,
} from 'class-validator';
import { LIBRARY_KINDS, LibraryKind } from '@movie-server/shared';
import { Trim } from '../../../common/decorators/transform.decorators';
import { sanitizePlainText } from '../../../common/security/sanitize';

const sanitize = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? sanitizePlainText(value) : value;

export class UpsertSmbServerDto {
  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  host!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;

  @IsOptional()
  @Trim()
  @Transform(sanitize)
  @IsString()
  @MaxLength(64)
  domain?: string;

  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  share!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateSmbServerDto {
  @IsOptional()
  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  host?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password?: string;

  @IsOptional()
  @Trim()
  @Transform(sanitize)
  @IsString()
  @MaxLength(64)
  domain?: string;

  @IsOptional()
  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  share?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class BrowseSmbDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1024)
  path?: string;
}

export class UpdateSmbCredentialsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

export class UploadSmbMediaDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1024)
  path?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  scan?: boolean;
}

export class AddSmbLibraryDto {
  @IsMongoId()
  serverId!: string;

  @Trim()
  @IsString()
  @MaxLength(1024)
  path!: string;

  @Trim()
  @Transform(sanitize)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsIn([...LIBRARY_KINDS])
  kind!: LibraryKind;
}
