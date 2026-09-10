import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminSettingsController } from './admin-settings.controller';
import { BrandingStorageService } from './branding-storage.service';
import { PublicSettingsController } from './public-settings.controller';
import { SettingsSecretCrypto } from './settings-secret.crypto';
import { SiteSettings, SiteSettingsSchema } from './schemas/site-settings.schema';
import { SiteSettingsService } from './site-settings.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: SiteSettings.name, schema: SiteSettingsSchema }]),
  ],
  controllers: [AdminSettingsController, PublicSettingsController],
  providers: [SiteSettingsService, BrandingStorageService, SettingsSecretCrypto],
  exports: [SiteSettingsService],
})
export class SettingsModule {}
