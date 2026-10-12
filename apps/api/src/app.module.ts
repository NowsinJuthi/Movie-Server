import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ValidationPipe } from '@nestjs/common';
import { validateEnv } from './config/env.validation';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';
import { UsersModule } from './users/users.module';
import { SessionsModule } from './sessions/sessions.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ProfilesModule } from './profiles/profiles.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { BillingModule } from './billing/billing.module';
import { MoviesModule } from './movies/movies.module';
import { SeriesModule } from './series/series.module';
import { LibraryModule } from './library/library.module';
import { StreamModule } from './stream/stream.module';
import { DevicesModule } from './devices/devices.module';
import { HomeModule } from './home/home.module';
import { SearchModule } from './search/search.module';
import { AdminModule } from './admin/admin.module';
import { LicenseModule } from './license/license.module';
import { SettingsModule } from './settings/settings.module';
import { RolePermissionsModule } from './role-permissions/role-permissions.module';
import { MovieUploadRequestsModule } from './movie-upload-requests/movie-upload-requests.module';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { HealthController } from './health/health.controller';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppThrottlerGuard } from './common/guards/throttler.guard';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';
import { SanitizePipe } from './common/pipes/sanitize.pipe';
import { SuperAdminBootstrap } from './bootstrap/super-admin.bootstrap';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

const useQueue = process.env.NODE_ENV !== 'test' && process.env.REDIS_HOST !== 'memory';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnv,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        autoIndex: true,
      }),
    }),
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, RedisService],
      useFactory: (config: ConfigService, redis: RedisService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('THROTTLE_TTL_MS') ?? 60_000,
            limit: config.get<number>('THROTTLE_LIMIT') ?? 100,
          },
        ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    ...(useQueue
      ? [
          BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              connection: {
                host: config.getOrThrow<string>('REDIS_HOST'),
                port: config.getOrThrow<number>('REDIS_PORT'),
                password: config.get<string>('REDIS_PASSWORD') || undefined,
              },
            }),
          }),
        ]
      : []),
    UsersModule,
    SessionsModule,
    MailModule.register(),
    AuthModule,
    ProfilesModule,
    SubscriptionsModule,
    BillingModule,
    MoviesModule,
    SeriesModule,
    LibraryModule.register(),
    StreamModule,
    DevicesModule,
    HomeModule,
    SearchModule,
    AdminModule,
    LicenseModule,
    SettingsModule,
    RolePermissionsModule,
    MovieUploadRequestsModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
  providers: [
    SuperAdminBootstrap,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_PIPE, useClass: SanitizePipe },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        stopAtFirstError: true,
      }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
