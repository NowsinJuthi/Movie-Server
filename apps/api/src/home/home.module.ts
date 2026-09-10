import { Module } from '@nestjs/common';
import { MoviesModule } from '../movies/movies.module';
import { SeriesModule } from '../series/series.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { MongooseModule } from '@nestjs/mongoose';
import { HomeService } from './home.service';
import { HomeController } from './home.controller';
import { HomeCmsService } from './home-cms.service';
import { AdminHomeController } from './admin-home.controller';
import { HomeHero, HomeHeroSchema } from './schemas/home-hero.schema';
import { HomeRowConfig, HomeRowConfigSchema } from './schemas/home-row-config.schema';

@Module({
  imports: [
    MoviesModule,
    SeriesModule,
    ProfilesModule,
    MongooseModule.forFeature([
      { name: HomeHero.name, schema: HomeHeroSchema },
      { name: HomeRowConfig.name, schema: HomeRowConfigSchema },
    ]),
  ],
  controllers: [HomeController, AdminHomeController],
  providers: [HomeService, HomeCmsService],
})
export class HomeModule {}
