import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SiteSettingsService } from '../settings/site-settings.service';

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  token?: string;
  kind: 'verification' | 'password-reset';
};

export const MAIL_QUEUE = 'mail';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  readonly outbox: OutboundEmail[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SiteSettingsService,
    @Optional() @InjectQueue(MAIL_QUEUE) private readonly mailQueue?: Queue,
  ) {}

  async enqueueVerification(to: string, displayName: string, token: string): Promise<void> {
    const appUrl = this.config.getOrThrow<string>('APP_URL');
    const link = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const mail = await this.settings.resolveMailConfig();
    await this.enqueue({
      to,
      kind: 'verification',
      token,
      subject: `Verify your ${mail.appName} account`,
      text: `Hi ${displayName},\n\nConfirm your email by opening this link:\n${link}\n\nIf you did not create an account, you can ignore this message.`,
    });
  }

  async enqueuePasswordReset(to: string, displayName: string, token: string): Promise<void> {
    const appUrl = this.config.getOrThrow<string>('APP_URL');
    const link = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const mail = await this.settings.resolveMailConfig();
    await this.enqueue({
      to,
      kind: 'password-reset',
      token,
      subject: `Reset your ${mail.appName} password`,
      text: `Hi ${displayName},\n\nReset your password by opening this link:\n${link}\n\nThis link expires shortly. If you did not request a reset, you can ignore this message.`,
    });
  }

  async send(message: OutboundEmail): Promise<void> {
    const mail = await this.settings.resolveMailConfig(true);
    if (!mail.transporter) {
      if (this.config.get('NODE_ENV') === 'production') {
        this.logger.error(
          `SMTP is not configured; ${message.kind} mail to ${message.to} was not sent.`,
        );
        return;
      }
      this.logger.log(`[mail:${message.kind}] to=${message.to}\n${message.text}`);
      return;
    }
    await mail.transporter.sendMail({
      from: mail.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }

  lastToken(email: string, kind: OutboundEmail['kind']): string | undefined {
    return [...this.outbox].reverse().find((item) => item.to === email && item.kind === kind)
      ?.token;
  }

  private async enqueue(message: OutboundEmail): Promise<void> {
    this.outbox.push(message);
    if (this.mailQueue) {
      await this.mailQueue.add('send', message, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
      });
      return;
    }
    await this.send(message);
  }
}
