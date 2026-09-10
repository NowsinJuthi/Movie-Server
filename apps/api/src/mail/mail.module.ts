import { DynamicModule, Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MAIL_QUEUE, MailService } from './mail.service';
import { MailProcessor } from './mail.processor';
import { SettingsModule } from '../settings/settings.module';

@Global()
@Module({})
export class MailModule {
  static register(): DynamicModule {
    const useQueue = process.env.NODE_ENV !== 'test' && process.env.REDIS_HOST !== 'memory';
    return {
      module: MailModule,
      imports: [
        SettingsModule,
        ...(useQueue ? [BullModule.registerQueue({ name: MAIL_QUEUE })] : []),
      ],
      providers: useQueue ? [MailService, MailProcessor] : [MailService],
      exports: [MailService],
    };
  }
}
