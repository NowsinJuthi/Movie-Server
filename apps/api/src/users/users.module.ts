import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UsersService } from './users.service';
import { PasswordService } from '../auth/password.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUserSubscriptionService } from './admin-user-subscription.service';
import { SessionsModule } from '../sessions/sessions.module';
import { Plan, PlanSchema } from '../subscriptions/schemas/plan.schema';
import { Subscription, SubscriptionSchema } from '../subscriptions/schemas/subscription.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Plan.name, schema: PlanSchema },
    ]),
    SessionsModule,
  ],
  controllers: [AdminUsersController],
  providers: [UsersService, PasswordService, AdminUserSubscriptionService],
  exports: [UsersService, MongooseModule, PasswordService],
})
export class UsersModule {}
