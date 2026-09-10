import { IsOptional, IsString, Matches } from 'class-validator';

export class SelectProfileDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be a 4-digit code.' })
  pin?: string;
}
