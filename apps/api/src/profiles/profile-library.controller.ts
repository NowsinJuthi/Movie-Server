import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { RequestUser } from '../auth/auth.types';
import { AddToListDto, UpsertRatingDto, UpsertReactionDto, UpsertWatchHistoryDto } from './dto/library.dto';
import { WatchHistoryService } from './watch-history.service';
import { MyListService } from './my-list.service';
import { FavoritesService } from './favorites.service';
import { MediaReactionsService } from './media-reactions.service';
import { UserRatingsService } from './user-ratings.service';
import { RecommendationsService } from './recommendations.service';
import { LibraryMediaService } from './library-media.service';
import { PersonalizationMediaKind } from '@movie-server/shared';

@Controller('profiles/:id')
export class ProfileLibraryController {
  constructor(
    private readonly history: WatchHistoryService,
    private readonly myList: MyListService,
    private readonly favorites: FavoritesService,
    private readonly reactions: MediaReactionsService,
    private readonly ratings: UserRatingsService,
    private readonly recommendations: RecommendationsService,
    private readonly library: LibraryMediaService,
  ) {}

  @Get('history')
  async historyList(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return { items: await this.history.list(user.id, id) };
  }

  @Put('history')
  async upsertHistory(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpsertWatchHistoryDto,
  ) {
    return { item: await this.history.upsert(user.id, id, dto) };
  }

  @Delete('history')
  async clearHistory(@CurrentUser() user: RequestUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.history.clear(user.id, id);
  }

  @Delete('history/:mediaId')
  async removeHistory(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.history.remove(user.id, id, mediaId);
  }

  @Get('continue-watching')
  async continueWatching(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return { items: await this.history.continueWatching(user.id, id) };
  }

  @Get('list')
  async myListItems(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    const items = await this.myList.list(user.id, id);
    return { items, titles: await this.library.titles(items.map((item) => item.mediaId)) };
  }

  @Post('list')
  async addToList(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AddToListDto,
  ) {
    return { item: await this.myList.add(user.id, id, dto.mediaId) };
  }

  @Delete('list/:mediaId')
  async removeFromList(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.myList.remove(user.id, id, mediaId);
  }

  @Get('favorites')
  async favoriteItems(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    const items = await this.favorites.list(user.id, id);
    return { items, titles: await this.library.titles(items.map((item) => item.mediaId)) };
  }

  @Post('favorites')
  async addFavorite(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AddToListDto,
  ) {
    return {
      item: await this.favorites.add(user.id, id, dto.mediaId, dto.kind ?? PersonalizationMediaKind.Movie),
    };
  }

  @Delete('favorites/:mediaId')
  async removeFavorite(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.favorites.remove(user.id, id, mediaId);
  }

  @Get('reactions')
  async reactionItems(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return { items: await this.reactions.list(user.id, id) };
  }

  @Put('reactions')
  async upsertReaction(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpsertReactionDto,
  ) {
    return this.reactions.upsert(user.id, id, dto.mediaId, dto.kind, dto.reaction);
  }

  @Get('ratings')
  async ratingItems(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return { items: await this.ratings.list(user.id, id) };
  }

  @Put('ratings')
  async upsertRating(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpsertRatingDto,
  ) {
    return { item: await this.ratings.upsert(user.id, id, dto.mediaId, dto.kind, dto.rating) };
  }

  @Delete('ratings/:mediaId')
  async removeRating(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.ratings.remove(user.id, id, mediaId);
  }

  @Get('personalization')
  async personalization(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    const [favorites, reactions, ratings, list] = await Promise.all([
      this.favorites.list(user.id, id),
      this.reactions.list(user.id, id),
      this.ratings.list(user.id, id),
      this.myList.list(user.id, id),
    ]);
    return {
      favorites,
      reactions,
      ratings,
      myListIds: list.map((item) => item.mediaId),
      favoriteIds: favorites.map((item) => item.mediaId),
    };
  }

  @Get('recommendations')
  async recommendationsList(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return { items: await this.recommendations.list(user.id, id) };
  }
}
