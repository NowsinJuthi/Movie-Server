import { Controller, Get, Param, Req } from '@nestjs/common';
import { PlanFeature } from '@movie-server/shared';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/auth.types';
import { RequireFeature, RequireSubscription } from '../subscriptions/decorators/subscription.decorators';
import { MoviesService } from './movies.service';

@Controller('collections')
@RequireSubscription()
@RequireFeature(PlanFeature.Catalog)
export class CollectionsController {
  constructor(private readonly movies: MoviesService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser) {
    const viewer = await this.movies.resolveViewer(user);
    return { collections: await this.movies.listPublicCollections(viewer) };
  }

  @Get(':id')
  async one(@CurrentUser() user: RequestUser, @Param('id') id: string, @Req() req: Request) {
    const viewer = await this.movies.resolveViewer(user);
    return this.movies.getPublicCollection(id, viewer, req.entitlement);
  }
}
