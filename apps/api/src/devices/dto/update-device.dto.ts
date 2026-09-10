import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/decorators/transform.decorators';

export class UpdateDeviceDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class DeviceIdentityDto {
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
