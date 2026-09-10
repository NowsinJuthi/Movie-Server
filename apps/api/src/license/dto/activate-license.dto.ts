import { IsString, MaxLength, MinLength } from 'class-validator';

export class ActivateLicenseDto {
  @IsString()
  @MinLength(20)
  @MaxLength(512)
  licenseKey!: string;
}
