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
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/auth.types';
import { Public } from '../common/decorators/public.decorator';
import { RequireSubscription } from '../subscriptions/decorators/subscription.decorators';
import { SkipSubscription } from '../subscriptions/decorators/skip-subscription.decorator';
import { StreamService, isSessionId } from './stream.service';
import { buildMasterPlaylist } from './hls-playlist';
import { HlsPackagerService } from './hls-packager.service';
import { SelectPlaybackTracksDto } from './dto/select-tracks.dto';
import { SeekPlaybackDto } from './dto/seek-playback.dto';

@Controller('stream')
@RequireSubscription()
export class StreamController {
  constructor(
    private readonly streams: StreamService,
    private readonly hlsPackager: HlsPackagerService,
  ) {}

  @Get('active')
  async active(@CurrentUser() user: RequestUser) {
    const sessions = await this.streams.listActive(user.id);
    return { streams: await this.streams.publicPlaybackSessions(sessions) };
  }

  @Public()
  @SkipSubscription()
  @SkipThrottle()
  @Get(':sessionId/master')
  async master(
    @Param('sessionId') sessionId: string,
    @Query('mt') mediaToken: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const sid = this.id(sessionId);
    const userId = await this.streams.resolveMediaUser(sid, mediaToken, req);
    const session = await this.streams.load(sid, userId);
    const body = buildMasterPlaylist(
      session.variants.map((variant) => ({
        resolution: variant.resolution,
        bandwidth: variant.bandwidth,
      })),
      session.mediaToken,
    );
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(body);
  }

  @Public()
  @SkipSubscription()
  @SkipThrottle()
  @Get(':sessionId/v/:quality')
  async variant(
    @Param('sessionId') sessionId: string,
    @Param('quality') quality: string,
    @Query('mt') mediaToken: string | undefined,
    @Query('t') startParam: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const sid = this.id(sessionId);
    const userId = await this.streams.resolveMediaUser(sid, mediaToken, req);
    const session = await this.streams.load(sid, userId);
    const resolution = quality.replace(/\.m3u8$/i, '');
    if (!session.variants.some((variant) => variant.resolution === resolution)) {
      throw new NotFoundException({ error: ErrorCode.NotFound, message: 'Variant not found.' });
    }
    const requestedStart = startParam ? Number(startParam) : 0;
    const startSeconds = Number.isFinite(requestedStart)
      ? Math.max(0, Math.min(requestedStart, session.durationSeconds || requestedStart))
      : 0;
    if (session.videoTranscode || session.videoRemux) {
      await this.streams.ensureMobileHls(
        sid,
        userId,
        resolution,
        startSeconds,
      );
    }
    const body = await this.streams.readVariantPlaylist(
      session,
      resolution,
      mediaToken ?? session.mediaToken,
    );
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(body);
  }

  @Public()
  @SkipSubscription()
  @SkipThrottle()
  @Get(':sessionId/hls/:segment')
  async hlsSegment(
    @Param('sessionId') sessionId: string,
    @Param('segment') segment: string,
    @Query('mt') mediaToken: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.streams.resolveMediaUser(this.id(sessionId), mediaToken, req);
    const filePath = this.hlsPackager.resolveSegmentPath(this.id(sessionId), segment);
    const lower = segment.toLowerCase();
    res.setHeader(
      'Content-Type',
      lower.endsWith('.ts')
        ? 'video/MP2T'
        : lower.endsWith('.mp4')
          ? 'video/mp4'
          : 'video/iso.segment',
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200);
    const stream = createReadStream(filePath);
    pipeToResponse(stream, res);
  }

  @Public()
  @SkipSubscription()
  @SkipThrottle()
  @Get(':sessionId/media')
  async media(
    @Param('sessionId') sessionId: string,
    @Query('mt') mediaToken: string | undefined,
    @Query('quality') quality: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = await this.streams.resolveMediaUser(this.id(sessionId), mediaToken, req);
    const ua = req.headers['user-agent'] ?? '';
    const disallowRemux = /iPhone|iPad|iPod/i.test(ua);
    const file = await this.streams.openMedia(this.id(sessionId), userId, quality, {
      disallowRemux,
    });
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

  @Public()
  @SkipSubscription()
  @SkipThrottle()
  @Get(':sessionId/audio/:assetId')
  async audio(
    @Param('sessionId') sessionId: string,
    @Param('assetId') assetId: string,
    @Query('mt') mediaToken: string | undefined,
    @Query('t') startParam: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = await this.streams.resolveMediaUser(this.id(sessionId), mediaToken, req);
    const startSeconds = startParam ? Number(startParam) : 0;
    const file = await this.streams.openAudio(
      this.id(sessionId),
      userId,
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

  @Public()
  @SkipSubscription()
  @SkipThrottle()
  @Get(':sessionId/subtitles/:assetId')
  async subtitles(
    @Param('sessionId') sessionId: string,
    @Param('assetId') assetId: string,
    @Query('mt') mediaToken: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = await this.streams.resolveMediaUser(this.id(sessionId), mediaToken, req);
    const body = await this.streams.openSubtitle(this.id(sessionId), userId, assetId);
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(body);
  }

  @Post(':sessionId/seek')
  @HttpCode(HttpStatus.OK)
  async seek(
    @CurrentUser() user: RequestUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: SeekPlaybackDto,
  ) {
    await this.streams.seekHls(this.id(sessionId), user.id, dto.seconds, dto.quality);
    return { ok: true, seconds: dto.seconds };
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
