import { IsIn, IsString } from 'class-validator';
import { USER_ROLES, UserRole } from '@movie-server/shared';

export class UpdateUserRoleDto {
  @IsString()
  @IsIn([...USER_ROLES])
  role!: UserRole;
}
