import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PlanFeature } from '@movie-server/shared';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { RequestUser } from '../auth/auth.types';
import { RequireFeature, RequireSubscription } from '../subscriptions/decorators/subscription.decorators';
import { QuerySearchDto, QuerySuggestDto } from './dto/query-search.dto';
import { SearchService } from './search.service';

@Controller('search')
@RequireSubscription()
@RequireFeature(PlanFeature.Catalog)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  async query(@CurrentUser() user: RequestUser, @Query() query: QuerySearchDto, @Req() req: Request) {
    return this.search.search(user, query, req.entitlement ?? null);
  }

  @Get('suggest')
  async suggest(@CurrentUser() user: RequestUser, @Query() query: QuerySuggestDto) {
    return this.search.suggest(user, query.q ?? '');
  }

  @Get('trending')
  async trending() {
    return this.search.trending();
  }

  @Get('similar/movies/:id')
  async similarMovie(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: Request,
  ) {
    return this.search.similarMovie(user, id, req.entitlement ?? null);
  }

  @Get('similar/series/:id')
  async similarSeries(@CurrentUser() user: RequestUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.search.similarSeries(user, id);
  }
}
