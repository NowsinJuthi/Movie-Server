import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AUTH_COOKIE } from '@movie-server/shared';
import { AuthService } from '../auth/auth.service';
import { AccessTokenPayload } from '../auth/auth.types';
import { LicenseService } from '../license/license.service';

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      const allowed = (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed'));
    },
    credentials: true,
  },
  namespace: '/realtime',
})
@Injectable()
export class RealtimeGateway implements OnGatewayConnection, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly license: LicenseService,
  ) {}

  onModuleInit(): void {
    this.logger.log('Realtime gateway ready (Socket.IO namespace /realtime)');
  }

  async onModuleDestroy(): Promise<void> {
    this.server?.disconnectSockets(true);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      if (this.config.get<boolean>('LICENSE_DISABLED') !== true) {
        await this.license.assertUsable();
      }
      const token = this.readToken(client);
      if (!token) {
        throw new UnauthorizedException('Missing access token');
      }
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      const user = await this.authService.validateAccessPayload(payload);
      client.data.user = user;
      await client.join(`user:${user.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return { event: 'pong', data: { ok: true, userId: client.data.user?.id } };
  }

  private readToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken) {
      return authToken;
    }
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    const cookieHeader = client.handshake.headers.cookie ?? '';
    const match = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${AUTH_COOKIE.Access}=`));
    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
  }
}
