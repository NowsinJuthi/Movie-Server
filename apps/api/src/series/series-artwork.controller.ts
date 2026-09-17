import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { ErrorCode, hasMinimumRole, UserRole } from '@movie-server/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequestUser } from '../auth/auth.types';
import { ArtworkStorageService } from '../movies/artwork-storage.service';
import { isArtworkKey } from '../movies/movie.util';
import { SeriesService } from './series.service';

@Controller('series/artwork')
export class SeriesArtworkController {
  constructor(
    private readonly artwork: ArtworkStorageService,
    private readonly series: SeriesService,
  ) {}

  @Public()
  @Get(':key')
  async get(@Param('key') key: string, @CurrentUser() user: RequestUser | undefined, @Res() res: Response) {
    if (!isArtworkKey(key)) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Not found.' });
    }
    const owner = await this.series.findArtworkOwner(key);
    if (!owner) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Not found.' });
    }
    const isAdmin = user ? hasMinimumRole(user.role, UserRole.Admin) : false;
    if (!owner.published && !isAdmin) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Not found.' });
    }
    const { stream, mime } = await this.artwork.open(key);
    res.type(mime);
    stream.pipe(res);
  }
}
