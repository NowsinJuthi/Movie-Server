import { Controller, Delete, Get, Inject, Param, forwardRef } from '@nestjs/common';
import { UserRole } from '@movie-server/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { SessionsService } from '../sessions/sessions.service';
import { DevicesService } from './devices.service';
import { PlaybackSessionStore } from '../stream/playback-session.store';
import { UsersService } from '../users/users.service';
import { toPublicSession } from '../sessions/session.mapper';
import { toPublicPlayback } from '../stream/playback-public';
import type { AdminAuthSession, AdminPlaybackSession, AdminSessionMonitor } from '@movie-server/shared';

@Controller('admin')
@Roles(UserRole.Admin)
export class AdminSessionsController {
  constructor(
    private readonly authSessions: SessionsService,
    private readonly devices: DevicesService,
    @Inject(forwardRef(() => PlaybackSessionStore)) private readonly liveStreams: PlaybackSessionStore,
    private readonly users: UsersService,
  ) {}

  @Get('sessions')
  async monitor(): Promise<AdminSessionMonitor> {
    const [sessionDocs, suspiciousDocs, live] = await Promise.all([
      this.authSessions.listRecentForAdmin(),
      this.authSessions.listSuspiciousForAdmin(),
      this.liveStreams.listAllLive(),
    ]);
    const userIds = [
      ...new Set([
        ...sessionDocs.map((item) => String(item.userId)),
        ...suspiciousDocs.map((item) => String(item.userId)),
        ...live.map((item) => item.userId),
      ]),
    ];
    const users = await this.users.findByIds(userIds);
    const emailById = new Map(users.map((item) => [String(item._id), item.email]));
    const withUser = (session: (typeof sessionDocs)[number]): AdminAuthSession => ({
      ...toPublicSession(session),
      userId: String(session.userId),
      userEmail: emailById.get(String(session.userId)) ?? '',
    });
    const streams: AdminPlaybackSession[] = live.map((item) => ({
      ...toPublicPlayback(item),
      userId: item.userId,
      userEmail: emailById.get(item.userId) ?? '',
    }));
    return {
      sessions: sessionDocs.map(withUser),
      streams,
      suspicious: suspiciousDocs.map(withUser),
    };
  }

  @Get('streams')
  async listLiveStreams() {
    const data = await this.monitor();
    return { streams: data.streams };
  }

  @Delete('sessions/:id')
  async revokeSession(@Param('id', ParseObjectIdPipe) id: string) {
    const session = await this.authSessions.revokeOwnedOrAdmin(id);
    if (session?.deviceKey) {
      const stillAuthed = await this.authSessions.hasActiveDevice(String(session.userId), session.deviceKey);
      if (!stillAuthed) {
        await this.liveStreams.stopForDevice(String(session.userId), session.deviceKey);
      }
    }
    return { revoked: Boolean(session) };
  }

  @Delete('devices/:id')
  async revokeDevice(@Param('id', ParseObjectIdPipe) id: string) {
    const device = await this.devices.revokeByAdmin(id);
    if (!device) {
      return { revoked: false };
    }
    const userId = String(device.userId);
    await this.authSessions.revokeByDevice(userId, device.deviceKey);
    await this.liveStreams.stopForDevice(userId, device.deviceKey);
    return { revoked: true };
  }
}
