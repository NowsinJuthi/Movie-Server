import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const prefix = config.get<string>('API_PREFIX') ?? 'api/v1';

  app.setGlobalPrefix(prefix);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts:
        config.get('NODE_ENV') === 'production' && (config.get<string>('APP_URL') ?? '').startsWith('https://')
          ? { maxAge: 15_552_000, includeSubDomains: true }
          : false,
    }),
  );
  app.use(cookieParser());
  app.enableShutdownHooks();

  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'Stripe-Signature', 'Range'],
    exposedHeaders: ['Accept-Ranges', 'Content-Range', 'Content-Length', 'Content-Type'],
  });

  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.set('trust proxy', 1);

  const port = config.get<number>('PORT') ?? 4000;
  await app.listen(port);
  logger.log(`${config.get('APP_NAME')} API listening on ${port} (${prefix})`);
}

bootstrap();
