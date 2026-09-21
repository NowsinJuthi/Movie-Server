import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UpdateSmtpSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  host?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  user?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fromName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fromEmail?: string;
}

export class UpdateEmailDomainsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(253, { each: true })
  allowlist?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(253, { each: true })
  blocklist?: string[];

  @IsOptional()
  @IsBoolean()
  allowlistEnabled?: boolean;
}

export class UpdateSiteSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  siteName?: string;

  @IsOptional()
  @IsBoolean()
  movieUploadRequestsEnabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateEmailDomainsDto)
  emailDomains?: UpdateEmailDomainsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSmtpSettingsDto)
  smtp?: UpdateSmtpSettingsDto;
}

export class SmtpTestDto {
  @IsEmail()
  @MaxLength(255)
  to!: string;
}
