import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { StreamModule } from '../stream/stream.module';
import { Device, DeviceSchema } from './schemas/device.schema';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { AdminSessionsController } from './admin-sessions.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Device.name, schema: DeviceSchema }]),
    SessionsModule,
    UsersModule,
    forwardRef(() => SubscriptionsModule),
    forwardRef(() => StreamModule),
  ],
  controllers: [DevicesController, AdminSessionsController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
