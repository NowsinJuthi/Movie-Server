import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { Plan, PlanSchema } from './schemas/plan.schema';
import { Subscription, SubscriptionSchema } from './schemas/subscription.schema';
import { SubscriptionEvent, SubscriptionEventSchema } from './schemas/subscription-event.schema';
import { PlansService } from './plans.service';
import { PlansBootstrap } from './plans.bootstrap';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionAccessService } from './subscription-access.service';
import { SubscriptionAccessGuard } from './guards/subscription-access.guard';
import { PlansController } from './plans.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { AdminPlansController } from './admin-plans.controller';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { ContentController } from './content.controller';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: Plan.name, schema: PlanSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SubscriptionEvent.name, schema: SubscriptionEventSchema },
    ]),
  ],
  controllers: [
    PlansController,
    SubscriptionsController,
    AdminPlansController,
    AdminSubscriptionsController,
    ContentController,
  ],
  providers: [
    PlansService,
    PlansBootstrap,
    SubscriptionsService,
    SubscriptionAccessService,
    { provide: APP_GUARD, useClass: SubscriptionAccessGuard },
  ],
  exports: [PlansService, SubscriptionsService, SubscriptionAccessService, MongooseModule],
})
export class SubscriptionsModule {}
