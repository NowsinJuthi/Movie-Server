import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { STAFF_PROFILE_IDS, USER_ROLES, UserRole } from '@movie-server/shared';
import { NormalizeEmail, Trim } from '../../common/decorators/transform.decorators';
import { sanitizePlainText } from '../../common/security/sanitize';

export class CreateAdminUserDto {
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Trim()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizePlainText(value) : value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @IsString()
  @IsIn([...USER_ROLES])
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  @IsOptional()
  @IsString()
  @IsIn([...STAFF_PROFILE_IDS])
  staffProfileId?: string;
}
