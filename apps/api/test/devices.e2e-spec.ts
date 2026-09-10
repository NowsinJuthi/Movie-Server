import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Server } from 'http';
import { ErrorCode, UserRole } from '@movie-server/shared';
import { UsersService } from '../src/users/users.service';

const password = 'StrongPass1x';
const prefix = '/api/v1';

function cookieJar(res: request.Response, previous = ''): string {
  const next = new Map(
    previous
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=');
        return [part.slice(0, idx), part.slice(idx + 1)] as const;
      }),
  );
  const setCookies = res.headers['set-cookie'];
  const list = Array.isArray(setCookies) ? setCookies : setCookies ? [setCookies] : [];
  for (const item of list) {
    const pair = item.split(';')[0];
    const idx = pair.indexOf('=');
    const name = pair.slice(0, idx);
    const value = pair.slice(idx + 1);
    if (item.toLowerCase().includes('expires=thu, 01 jan 1970') || value === '') {
      next.delete(name);
    } else {
      next.set(name, value);
    }
  }
  return [...next.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function assertNoSecrets(body: unknown) {
  const raw = JSON.stringify(body);
  expect(raw).not.toMatch(/tokenHash|replacedByHash|accessToken|refreshToken|"password"/i);
}

describe('Devices and sessions (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let mongod: MongoMemoryServer;
  let users: UsersService;

  beforeAll(async () => {
    process.env.SUBSCRIPTION_REQUIRE_PAYMENT = 'false';
    process.env.MEDIA_PROBE = 'fake';
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
    users = app.get(UsersService);
  }, 180000);

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  async function login(email: string, extra: Record<string, string> = {}): Promise<string> {
    const res = await request(server).post(`${prefix}/auth/login`).send({ email, password, ...extra });
    expect(res.status).toBe(200);
    assertNoSecrets(res.body);
    return cookieJar(res);
  }

  async function seedUser(email: string, role: UserRole = UserRole.User) {
    return users.createUser({
      email,
      password,
      displayName: email.split('@')[0],
      emailVerified: true,
      role,
    });
  }

  async function selectProfile(cookies: string): Promise<string> {
    const profiles = await request(server).get(`${prefix}/profiles`).set('Cookie', cookies);
    expect(profiles.status).toBe(200);
    const profileId = profiles.body.profiles[0].id as string;
    return cookieJar(
      await request(server).post(`${prefix}/profiles/${profileId}/select`).set('Cookie', cookies).send({}),
      cookies,
    );
  }

  it('registers devices, enforces plan limits, revokes sessions, and hides secrets', async () => {
    await seedUser('admin-devices@example.com', UserRole.Admin);
    await seedUser('device-viewer@example.com');
    await seedUser('device-other@example.com');
    const admin = await login('admin-devices@example.com');
    let viewer = await login('device-viewer@example.com', { deviceId: 'desk-01', deviceName: 'Desk' });
    const other = await login('device-other@example.com');

    const listed = await request(server).get(`${prefix}/devices`).set('Cookie', viewer);
    expect(listed.status).toBe(200);
    assertNoSecrets(listed.body);
    expect(listed.body.deviceCount).toBe(0);
    expect(listed.body.devices).toHaveLength(1);
    expect(listed.body.devices[0].current).toBe(true);
    expect(listed.body.devices[0].countsTowardLimit).toBe(false);
    expect(listed.body.devices[0]).not.toHaveProperty('deviceKey');
    expect(listed.body.sessions).toHaveLength(1);
    expect(listed.body.sessions[0].current).toBe(true);

    const sessions = await request(server).get(`${prefix}/auth/sessions`).set('Cookie', viewer);
    expect(sessions.status).toBe(200);
    assertNoSecrets(sessions.body);
    expect(sessions.body.sessions).toHaveLength(1);

    expect(
      (await request(server).post(`${prefix}/subscriptions`).set('Cookie', viewer).send({ planSlug: 'basic', billingCycle: 'monthly' }))
        .status,
    ).toBe(201);
    viewer = await selectProfile(viewer);

    const movie = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Device Cap',
        description: 'Used to occupy a playback device slot.',
        releaseYear: 2024,
        runtimeMinutes: 90,
        genres: ['drama'],
        maturityRating: 'mature',
        published: true,
      });
    expect(movie.status).toBe(201);
    const movieId = movie.body.movie.id as string;
    const media = await request(server)
      .post(`${prefix}/admin/movies/${movieId}/media`)
      .set('Cookie', admin)
      .send({ kind: 'video', quality: '480p', language: 'en', status: 'ready' });
    expect(media.status).toBe(201);

    const playback = await request(server)
      .post(`${prefix}/movies/${movieId}/playback`)
      .set('Cookie', viewer)
      .send({ quality: 'sd', deviceId: 'living-room', deviceLabel: 'TV' });
    expect(playback.status).toBe(200);
    assertNoSecrets(playback.body);

    const afterPlay = await request(server).get(`${prefix}/devices`).set('Cookie', viewer);
    expect(afterPlay.status).toBe(200);
    expect(afterPlay.body.deviceCount).toBe(1);
    expect(afterPlay.body.streamCount).toBe(1);
    const playing = afterPlay.body.devices.find((item: { countsTowardLimit: boolean }) => item.countsTowardLimit);
    expect(playing?.playing).toBe(true);

    const active = await request(server).get(`${prefix}/stream/active`).set('Cookie', viewer);
    expect(active.status).toBe(200);
    expect(active.body.streams).toHaveLength(1);
    assertNoSecrets(active.body);

    const secondDevice = await request(server)
      .post(`${prefix}/movies/${movieId}/playback`)
      .set('Cookie', viewer)
      .send({ quality: 'sd', deviceId: 'phone-1', deviceLabel: 'Phone' });
    expect(secondDevice.status).toBe(403);
    expect(secondDevice.body.error).toBe(ErrorCode.DeviceLimitReached);

    const livingRoom = afterPlay.body.devices.find(
      (item: { id: string; name: string; playing?: boolean; countsTowardLimit?: boolean }) =>
        item.countsTowardLimit || item.name === 'TV' || item.playing,
    );
    expect(livingRoom).toBeTruthy();
    const removed = await request(server)
      .delete(`${prefix}/devices/${livingRoom.id}`)
      .set('Cookie', viewer);
    expect(removed.status).toBe(200);
    expect(removed.body.current).toBe(false);

    const retryPhone = await request(server)
      .post(`${prefix}/movies/${movieId}/playback`)
      .set('Cookie', viewer)
      .send({ quality: 'sd', deviceId: 'phone-1', deviceLabel: 'Phone' });
    expect(retryPhone.status).toBe(200);

    const otherDevices = await request(server).get(`${prefix}/devices`).set('Cookie', other);
    expect(otherDevices.status).toBe(200);
    expect(otherDevices.body.devices.some((item: { id: string }) => item.id === livingRoom.id)).toBe(false);
    const steal = await request(server)
      .delete(`${prefix}/devices/${afterPlay.body.devices[0].id}`)
      .set('Cookie', other);
    expect([403, 404]).toContain(steal.status);

    const forbiddenAdmin = await request(server).get(`${prefix}/admin/sessions`).set('Cookie', viewer);
    expect(forbiddenAdmin.status).toBe(403);

    const adminMonitor = await request(server).get(`${prefix}/admin/sessions`).set('Cookie', admin);
    expect(adminMonitor.status).toBe(200);
    assertNoSecrets(adminMonitor.body);
    expect(Array.isArray(adminMonitor.body.sessions)).toBe(true);
    expect(Array.isArray(adminMonitor.body.streams)).toBe(true);
    expect(adminMonitor.body.streams.some((item: { deviceKey: string }) => item.deviceKey === 'phone-1')).toBe(true);

    const secondLogin = await login('device-viewer@example.com', { deviceId: 'desk-01' });
    const both = await request(server).get(`${prefix}/auth/sessions`).set('Cookie', secondLogin);
    expect(both.body.sessions.length).toBeGreaterThanOrEqual(2);
    const otherSession = both.body.sessions.find((item: { current: boolean }) => !item.current);
    expect(otherSession).toBeTruthy();
    const revoked = await request(server)
      .delete(`${prefix}/auth/sessions/${otherSession.id}`)
      .set('Cookie', secondLogin);
    expect(revoked.status).toBe(200);
    expect(revoked.body.current).toBe(false);
    const stale = await request(server).get(`${prefix}/auth/me`).set('Cookie', viewer);
    expect(stale.status).toBe(401);

    const logoutAll = await request(server).post(`${prefix}/auth/logout-all`).set('Cookie', secondLogin);
    expect(logoutAll.status).toBe(200);
    assertNoSecrets(logoutAll.body);
    const afterLogout = await request(server).get(`${prefix}/auth/me`).set('Cookie', secondLogin);
    expect(afterLogout.status).toBe(401);

    const anon = await request(server).get(`${prefix}/devices`);
    expect(anon.status).toBe(401);
  });
});
