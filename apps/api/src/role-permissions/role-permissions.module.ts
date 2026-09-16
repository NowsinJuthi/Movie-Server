import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolePermissions, RolePermissionsSchema } from './schemas/role-permissions.schema';
import { RolePermissionsService } from './role-permissions.service';
import { RolePermissionsController } from './role-permissions.controller';
import { RolePermissionsAdminController } from './role-permissions-admin.controller';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RolePermissions.name, schema: RolePermissionsSchema },
    ]),
  ],
  controllers: [RolePermissionsController, RolePermissionsAdminController],
  providers: [RolePermissionsService, PermissionsGuard],
  exports: [RolePermissionsService, PermissionsGuard],
})
export class RolePermissionsModule {}
