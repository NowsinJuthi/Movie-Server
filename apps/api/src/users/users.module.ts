import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UsersService } from './users.service';
import { PasswordService } from '../auth/password.service';
import { AdminUsersController } from './admin-users.controller';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), SessionsModule],
  controllers: [AdminUsersController],
  providers: [UsersService, PasswordService],
  exports: [UsersService, MongooseModule, PasswordService],
})
export class UsersModule {}
