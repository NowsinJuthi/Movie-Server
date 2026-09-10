import { Body, Controller, Delete, Get, Inject, Param, Patch, forwardRef } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { RequestUser } from '../auth/auth.types';
import { DevicesService } from './devices.service';
import { SessionsService } from '../sessions/sessions.service';
import { PlaybackSessionStore } from '../stream/playback-session.store';
import { SubscriptionAccessService } from '../subscriptions/subscription-access.service';
import { toPublicPlayback } from '../stream/playback-public';
import { toPublicSession } from '../sessions/session.mapper';
import { UpdateDeviceDto } from './dto/update-device.dto';
import type { DeviceSecurityOverview } from '@movie-server/shared';

@Controller('devices')
export class DevicesController {
  constructor(
    private readonly devices: DevicesService,
    private readonly sessions: SessionsService,
    @Inject(forwardRef(() => PlaybackSessionStore)) private readonly streams: PlaybackSessionStore,
    private readonly access: SubscriptionAccessService,
  ) {}

  @Get()
  async list(@CurrentUser() user: RequestUser): Promise<DeviceSecurityOverview> {
    const entitlement = await this.access.getEntitlement(user.id);
    const [deviceDocs, sessionDocs, streams] = await Promise.all([
      this.devices.list(user.id),
      this.sessions.listActiveForUser(user.id),
      this.streams.listActive(user.id),
    ]);
    const playingKeys = new Set(streams.map((item) => item.deviceId));
    const currentKey = user.deviceKey ?? sessionDocs.find((item) => String(item._id) === user.sessionId)?.deviceKey;
    return {
      devices: deviceDocs.map((item) =>
        this.devices.toPublic(item, { currentDeviceKey: currentKey, playingKeys }),
      ),
      sessions: sessionDocs.map((item) => toPublicSession(item, user.sessionId)),
      streams: streams.map(toPublicPlayback),
      maxDevices: entitlement.maxDevices,
      maxStreams: entitlement.maxStreams,
      deviceCount: deviceDocs.filter((item) => item.countsTowardLimit).length,
      streamCount: streams.length,
    };
  }

  @Patch(':id')
  async rename(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    const device = await this.devices.rename(user.id, id, dto.name);
    return { device: this.devices.toPublic(device, { currentDeviceKey: user.deviceKey }) };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: RequestUser, @Param('id', ParseObjectIdPipe) id: string) {
    const device = await this.devices.revoke(user.id, id);
    await this.sessions.revokeByDevice(user.id, device.deviceKey);
    await this.streams.stopForDevice(user.id, device.deviceKey);
    return {
      message: 'Device signed out.',
      current: user.deviceKey === device.deviceKey,
    };
  }
}
