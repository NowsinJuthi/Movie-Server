import { Controller, Get, Param, Req } from '@nestjs/common';
import { PlanFeature } from '@movie-server/shared';
import { Request } from 'express';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { RequireFeature, RequireSubscription } from '../subscriptions/decorators/subscription.decorators';
import { LibraryService } from './library.service';

@Controller('libraries')
@RequireSubscription()
@RequireFeature(PlanFeature.Catalog)
export class PublicLibraryController {
  constructor(private readonly libraries: LibraryService) {}

  @Get()
  list() {
    return this.libraries.listPublic();
  }

  @Get(':id')
  browse(@Param('id', ParseObjectIdPipe) id: string, @Req() req: Request) {
    return this.libraries.browsePublic(id, req.entitlement ?? null);
  }
}
