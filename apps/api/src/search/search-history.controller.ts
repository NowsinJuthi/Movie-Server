import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { PlanFeature } from '@movie-server/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { RequestUser } from '../auth/auth.types';
import { RequireFeature, RequireSubscription } from '../subscriptions/decorators/subscription.decorators';
import { RecordSearchDto } from './dto/query-search.dto';
import { SearchService } from './search.service';

@Controller('profiles/:id/search-history')
@RequireSubscription()
@RequireFeature(PlanFeature.Catalog)
export class SearchHistoryController {
  constructor(private readonly search: SearchService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.search.history(user.id, id);
  }

  @Post()
  async record(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RecordSearchDto,
  ) {
    await this.search.recordHistory(user.id, id, dto.query, dto.resultCount ?? 0);
    return this.search.history(user.id, id);
  }

  @Delete()
  async clear(@CurrentUser() user: RequestUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.search.clearHistory(user.id, id);
  }
}
