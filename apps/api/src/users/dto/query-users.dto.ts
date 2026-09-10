import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { USER_ROLES, UserRole } from '@movie-server/shared';
import { Trim } from '../../common/decorators/transform.decorators';

function toBool({ value }: { value: unknown }): boolean | undefined {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}

export class QueryUsersDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn([...USER_ROLES])
  role?: UserRole;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['newest', 'name', 'email'])
  sort?: 'newest' | 'name' | 'email';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class PatchUserDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
