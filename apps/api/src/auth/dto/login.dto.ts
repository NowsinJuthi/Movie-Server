import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail, Trim } from '../../common/decorators/transform.decorators';

export class LoginDto {
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  deviceId?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  deviceName?: string;
}
