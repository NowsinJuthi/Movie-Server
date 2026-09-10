import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ErrorCode } from '@movie-server/shared';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Readable } from 'stream';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/auth.types';
import { RequireSubscription } from '../subscriptions/decorators/subscription.decorators';
import { StreamService, isSessionId } from './stream.service';
import { toPublicPlayback } from './playback-public';
import { buildMasterPlaylist, buildMediaPlaylist } from './hls-playlist';
import { SelectPlaybackTracksDto } from './dto/select-tracks.dto';

@Controller('stream')
@RequireSubscription()
export class StreamController {
  constructor(private readonly streams: StreamService) {}

  @Get('active')
  async active(@CurrentUser() user: RequestUser) {
    const sessions = await this.streams.listActive(user.id);
    return { streams: sessions.map(toPublicPlayback) };
  }

  @SkipThrottle()
  @Get(':sessionId/master')
  async master(@CurrentUser() user: RequestUser, @Param('sessionId') sessionId: string, @Res() res: Response) {
    const session = await this.streams.load(this.id(sessionId), user.id);
    const body = buildMasterPlaylist(
      session.variants.map((variant) => ({
        resolution: variant.resolution,
        bandwidth: variant.bandwidth,
      })),
    );
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(body);
  }

  @SkipThrottle()
  @Get(':sessionId/v/:quality')
  async variant(
    @CurrentUser() user: RequestUser,
    @Param('sessionId') sessionId: string,
    @Param('quality') quality: string,
    @Res() res: Response,
  ) {
    const session = await this.streams.load(this.id(sessionId), user.id);
    const resolution = quality.replace(/\.m3u8$/i, '');
    if (!session.variants.some((variant) => variant.resolution === resolution)) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Variant not found.' });
    }
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buildMediaPlaylist(session.durationSeconds, resolution));
  }

  @SkipThrottle()
  @Get(':sessionId/media')
  async media(
    @CurrentUser() user: RequestUser,
    @Param('sessionId') sessionId: string,
    @Query('quality') quality: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const file = await this.streams.openMedia(this.id(sessionId), user.id, quality);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', file.mime);

    // Fragmented remux has no known Content-Length / Range support.
    if (file.remux) {
      res.status(200);
      const stream = await file.open();
      pipeToResponse(stream, res);
      return;
    }

    const range = this.streams.parseRange(req.headers.range, file.size);
    res.setHeader('Accept-Ranges', 'bytes');
    if (!range) {
      res.setHeader('Content-Length', file.size);
      res.status(200);
      const stream = await file.open();
      pipeToResponse(stream, res);
      return;
    }
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${file.size}`);
    res.setHeader('Content-Length', range.end - range.start + 1);
    res.status(206);
    const stream = await file.open(range);
    pipeToResponse(stream, res);
  }

  @SkipThrottle()
  @Get(':sessionId/audio/:assetId')
  async audio(
    @CurrentUser() user: RequestUser,
    @Param('sessionId') sessionId: string,
    @Param('assetId') assetId: string,
    @Query('t') startParam: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const startSeconds = startParam ? Number(startParam) : 0;
    const file = await this.streams.openAudio(
      this.id(sessionId),
      user.id,
      assetId,
      Number.isFinite(startSeconds) ? startSeconds : 0,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', file.mime);
    if (file.remux) {
      res.status(200);
      const stream = await file.open();
      pipeToResponse(stream, res);
      return;
    }
    const range = this.streams.parseRange(req.headers.range, file.size);
    res.setHeader('Accept-Ranges', 'bytes');
    if (!range) {
      res.setHeader('Content-Length', file.size);
      res.status(200);
      const stream = await file.open();
      pipeToResponse(stream, res);
      return;
    }
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${file.size}`);
    res.setHeader('Content-Length', range.end - range.start + 1);
    res.status(206);
    const stream = await file.open(range);
    pipeToResponse(stream, res);
  }

  @SkipThrottle()
  @Get(':sessionId/subtitles/:assetId')
  async subtitles(
    @CurrentUser() user: RequestUser,
    @Param('sessionId') sessionId: string,
    @Param('assetId') assetId: string,
    @Res() res: Response,
  ) {
    const body = await this.streams.openSubtitle(this.id(sessionId), user.id, assetId);
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(body);
  }

  @Post(':sessionId/tracks')
  @HttpCode(HttpStatus.OK)
  async tracks(
    @CurrentUser() user: RequestUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: SelectPlaybackTracksDto,
  ) {
    const session = await this.streams.selectTracks(this.id(sessionId), user.id, {
      audioId: dto.audioId,
      subtitleId: dto.subtitleId,
    });
    return { session };
  }

  @Post(':sessionId/heartbeat')
  @HttpCode(HttpStatus.OK)
  async heartbeat(@CurrentUser() user: RequestUser, @Param('sessionId') sessionId: string) {
    const session = await this.streams.heartbeat(this.id(sessionId), user.id);
    return { session };
  }

  @Delete(':sessionId')
  async stop(@CurrentUser() user: RequestUser, @Param('sessionId') sessionId: string) {
    await this.streams.stop(this.id(sessionId), user.id);
    return { stopped: true };
  }

  private id(sessionId: string): string {
    if (!isSessionId(sessionId)) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Stream not found.' });
    }
    return sessionId;
  }
}

function pipeToResponse(stream: Readable, res: Response): void {
  const cleanup = () => {
    if (!stream.destroyed) {
      stream.destroy();
    }
  };
  res.once('close', cleanup);
  res.once('finish', cleanup);
  stream.once('error', () => {
    cleanup();
    if (!res.headersSent) {
      res.status(500).end();
    } else if (!res.writableEnded) {
      res.end();
    }
  });
  stream.pipe(res);
}
