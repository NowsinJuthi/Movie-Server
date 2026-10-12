import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { InstanceLicense, InstanceLicenseSchema } from './schemas/instance-license.schema';
import { AdminLicenseController } from './admin-license.controller';
import { LicenseController } from './license.controller';
import { LicenseGuard } from './license.guard';
import { LicenseService } from './license.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: InstanceLicense.name, schema: InstanceLicenseSchema }]),
  ],
  controllers: [LicenseController, AdminLicenseController],
  providers: [LicenseService, { provide: APP_GUARD, useClass: LicenseGuard }],
  exports: [LicenseService],
})
export class LicenseModule {}
