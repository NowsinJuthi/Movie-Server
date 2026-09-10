import { IsOptional, IsString, Matches } from 'class-validator';

export class SetProfilePinDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be a 4-digit code.' })
  pin!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be a 4-digit code.' })
  currentPin?: string;
}

export class RemoveProfilePinDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be a 4-digit code.' })
  currentPin!: string;
}
