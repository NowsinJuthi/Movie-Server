import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Server } from 'http';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
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

function assertNoPaths(body: unknown) {
  expect(JSON.stringify(body)).not.toMatch(/C:\\|\/var\/|\/home\/|storage\/uploads/i);
}

describe('Playback streaming (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let mongod: MongoMemoryServer;
  let users: UsersService;
  let moviesDir: string;

  beforeAll(async () => {
    process.env.SUBSCRIPTION_REQUIRE_PAYMENT = 'false';
    process.env.MEDIA_PROBE = 'fake';
    moviesDir = await mkdtemp(path.join(os.tmpdir(), 'cv-stream-movies-'));
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
    await rm(moviesDir, { recursive: true, force: true });
  });

  async function login(email: string): Promise<string> {
    const res = await request(server).post(`${prefix}/auth/login`).send({ email, password });
    expect(res.status).toBe(200);
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

  async function waitScan(cookies: string, id: string) {
    for (let i = 0; i < 100; i++) {
      const res = await request(server).get(`${prefix}/admin/libraries/scans/${id}`).set('Cookie', cookies);
      expect(res.status).toBe(200);
      const status = res.body.scan?.status as string;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        return res;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Timed out waiting for library scan.');
  }

  it('authorizes HLS sessions, enforces stream/device limits, and never leaks paths', async () => {
    await seedUser('admin-stream@example.com', UserRole.Admin);
    await seedUser('stream-viewer@example.com');
    await seedUser('stream-other@example.com');
    const admin = await login('admin-stream@example.com');
    let viewer = await login('stream-viewer@example.com');
    let other = await login('stream-other@example.com');

    expect(
      (
        await request(server)
          .post(`${prefix}/subscriptions`)
          .set('Cookie', viewer)
          .send({ planSlug: 'basic', billingCycle: 'monthly' })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(server)
          .post(`${prefix}/subscriptions`)
          .set('Cookie', other)
          .send({ planSlug: 'basic', billingCycle: 'monthly' })
      ).status,
    ).toBe(201);
    viewer = await selectProfile(viewer);
    other = await selectProfile(other);

    const alpha = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Stream Alpha',
        description: 'First concurrent title used to occupy a stream slot.',
        releaseYear: 2024,
        runtimeMinutes: 100,
        genres: ['action'],
        maturityRating: 'mature',
        published: true,
      });
    expect(alpha.status).toBe(201);
    const alphaId = alpha.body.movie.id as string;

    const beta = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Stream Beta',
        description: 'Second concurrent title used to trip the stream cap.',
        releaseYear: 2024,
        runtimeMinutes: 90,
        genres: ['drama'],
        maturityRating: 'mature',
        published: true,
      });
    expect(beta.status).toBe(201);
    const betaId = beta.body.movie.id as string;

    const fileMovie = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Stream Probe',
        description: 'Matched by the library scanner so byte-range delivery can be tested.',
        releaseYear: 2024,
        runtimeMinutes: 95,
        genres: ['scifi'],
        maturityRating: 'mature',
        published: true,
      });
    expect(fileMovie.status).toBe(201);
    const fileMovieId = fileMovie.body.movie.id as string;

    for (const movieId of [alphaId, betaId]) {
      const media = await request(server)
        .post(`${prefix}/admin/movies/${movieId}/media`)
        .set('Cookie', admin)
        .send({ kind: 'video', quality: '480p', language: 'en', status: 'ready' });
      expect(media.status).toBe(201);
      assertNoPaths(media.body);
    }

    const series = await request(server)
      .post(`${prefix}/admin/series`)
      .set('Cookie', admin)
      .send({
        title: 'Marker Nights',
        description: 'Used to verify skip intro and recap markers round-trip.',
        firstAirYear: 2023,
        genres: ['drama'],
        maturityRating: 'mature',
        published: true,
        autoPlayNext: true,
      });
    expect(series.status).toBe(201);
    const seriesId = series.body.series.id as string;
    const season = await request(server)
      .post(`${prefix}/admin/series/${seriesId}/seasons`)
      .set('Cookie', admin)
      .send({ seasonNumber: 1, name: 'Season 1', published: true });
    const seasonId = season.body.season.id as string;
    const episode = await request(server)
      .post(`${prefix}/admin/series/${seriesId}/seasons/${seasonId}/episodes`)
      .set('Cookie', admin)
      .send({
        episodeNumber: 1,
        title: 'Cold Open',
        description: 'An episode with skippable intro and recap windows.',
        runtimeMinutes: 42,
        published: true,
      });
    expect(episode.status).toBe(201);
    const episodeId = episode.body.episode.id as string;
    await request(server)
      .post(`${prefix}/admin/series/${seriesId}/seasons/${seasonId}/episodes/${episodeId}/media`)
      .set('Cookie', admin)
      .send({ kind: 'video', quality: '480p', language: 'en', status: 'ready' });

    const markers = await request(server)
      .patch(`${prefix}/admin/series/${seriesId}/seasons/${seasonId}/episodes/${episodeId}`)
      .set('Cookie', admin)
      .send({
        introStartSeconds: 8,
        introEndSeconds: 72,
        recapStartSeconds: 72,
        recapEndSeconds: 110,
        creditsStartSeconds: 2400,
      });
    expect(markers.status).toBe(200);
    expect(markers.body.episode.markers.introEndSeconds).toBe(72);

    const playback = await request(server)
      .post(`${prefix}/movies/${alphaId}/playback`)
      .set('Cookie', viewer)
      .send({ quality: 'sd', deviceId: 'living-room', deviceLabel: 'TV' });
    expect(playback.status).toBe(200);
    expect(playback.body.allowed).toBe(true);
    expect(playback.body.session).toBeTruthy();
    expect(playback.body.session.hlsUrl).toMatch(
      /^\/api\/v1\/stream\/[a-f0-9]{32}\/master\?mt=[a-f0-9]{32}$/,
    );
    expect(playback.body.session.progressiveUrl).toMatch(
      /^\/api\/v1\/stream\/[a-f0-9]{32}\/media\?mt=[a-f0-9]{32}$/,
    );
    assertNoPaths(playback.body);
    const sessionId = playback.body.session.id as string;

    const master = await request(server)
      .get(`${prefix}/stream/${sessionId}/master`)
      .set('Cookie', viewer);
    expect(master.status).toBe(200);
    expect(String(master.text)).toContain('#EXTM3U');
    expect(String(master.text)).toContain('v/480p');
    expect(String(master.headers['content-type'])).toMatch(/mpegurl|x-mpegURL/i);

    const variant = await request(server)
      .get(`${prefix}/stream/${sessionId}/v/480p`)
      .set('Cookie', viewer);
    expect(variant.status).toBe(200);
    expect(String(variant.text)).toContain('../media?quality=480p');

    const anonMaster = await request(server).get(`${prefix}/stream/${sessionId}/master`);
    expect(anonMaster.status).toBe(401);

    const otherMaster = await request(server)
      .get(`${prefix}/stream/${sessionId}/master`)
      .set('Cookie', other);
    expect(otherMaster.status).toBe(403);

    const missingFile = await request(server)
      .get(`${prefix}/stream/${sessionId}/media`)
      .set('Cookie', viewer);
    expect(missingFile.status).toBe(404);
    expect(missingFile.body.error).toBe(ErrorCode.PlaybackUnavailable);

    const secondStream = await request(server)
      .post(`${prefix}/movies/${betaId}/playback`)
      .set('Cookie', viewer)
      .send({ quality: 'sd', deviceId: 'living-room', deviceLabel: 'TV' });
    expect(secondStream.status).toBe(403);
    expect(secondStream.body.error).toBe(ErrorCode.StreamLimitReached);

    const secondDevice = await request(server)
      .post(`${prefix}/movies/${alphaId}/playback`)
      .set('Cookie', viewer)
      .send({ quality: 'sd', deviceId: 'phone-1', deviceLabel: 'Phone' });
    expect(secondDevice.status).toBe(403);
    expect(secondDevice.body.error).toBe(ErrorCode.DeviceLimitReached);

    const beat = await request(server)
      .post(`${prefix}/stream/${sessionId}/heartbeat`)
      .set('Cookie', viewer);
    expect(beat.status).toBe(200);
    expect(beat.body.session.id).toBe(sessionId);

    const stopped = await request(server).delete(`${prefix}/stream/${sessionId}`).set('Cookie', viewer);
    expect(stopped.status).toBe(200);
    expect(stopped.body.stopped).toBe(true);

    const afterStop = await request(server)
      .post(`${prefix}/movies/${betaId}/playback`)
      .set('Cookie', viewer)
      .send({ quality: 'sd', deviceId: 'living-room', deviceLabel: 'TV' });
    expect(afterStop.status).toBe(200);
    expect(afterStop.body.allowed).toBe(true);

    const progress = await request(server)
      .put(`${prefix}/movies/${alphaId}/progress`)
      .set('Cookie', viewer)
      .send({ progressSeconds: 120, durationSeconds: 6000 });
    expect(progress.status).toBe(200);
    const watching = await request(server).get(`${prefix}/movies/continue-watching`).set('Cookie', viewer);
    expect(watching.status).toBe(200);
    expect(watching.body.items[0].movie.id).toBe(alphaId);
    assertNoPaths(watching.body);

    const episodePlayback = await request(server)
      .post(`${prefix}/series/${seriesId}/episodes/${episodeId}/playback`)
      .set('Cookie', viewer)
      .send({ quality: 'sd', deviceId: 'living-room' });
    expect(episodePlayback.status).toBe(403);
    expect(episodePlayback.body.error).toBe(ErrorCode.StreamLimitReached);

    await request(server)
      .delete(`${prefix}/stream/${afterStop.body.session.id}`)
      .set('Cookie', viewer);

    const episodeOk = await request(server)
      .post(`${prefix}/series/${seriesId}/episodes/${episodeId}/playback`)
      .set('Cookie', viewer)
      .send({ quality: 'sd', deviceId: 'living-room' });
    expect(episodeOk.status).toBe(200);
    expect(episodeOk.body.allowed).toBe(true);
    expect(episodeOk.body.session).toBeTruthy();
    expect(episodeOk.body.markers.introStartSeconds).toBe(8);
    expect(episodeOk.body.markers.recapEndSeconds).toBe(110);
    assertNoPaths(episodeOk.body);

    await request(server)
      .delete(`${prefix}/stream/${episodeOk.body.session.id}`)
      .set('Cookie', viewer);

    const movieFile = path.join(moviesDir, 'Stream Probe (2024).480p.mp4');
    await writeFile(movieFile, Buffer.alloc(8192, 11));
    const library = await request(server)
      .post(`${prefix}/admin/libraries`)
      .set('Cookie', admin)
      .send({ name: 'Stream Files', kind: 'movies', rootPath: moviesDir });
    expect(library.status).toBe(201);
    assertNoPaths(library.body);
    const scan = await request(server)
      .post(`${prefix}/admin/libraries/scans`)
      .set('Cookie', admin)
      .send({});
    expect(scan.status).toBe(202);
    const done = await waitScan(admin, scan.body.scan.id);
    expect(done.body.scan.status).toBe('completed');

    const filePlayback = await request(server)
      .post(`${prefix}/movies/${fileMovieId}/playback`)
      .set('Cookie', viewer)
      .send({ quality: 'sd', deviceId: 'living-room' });
    expect(filePlayback.status).toBe(200);
    const fileSession = filePlayback.body.session.id as string;
    assertNoPaths(filePlayback.body);

    const full = await request(server)
      .get(`${prefix}/stream/${fileSession}/media`)
      .set('Cookie', viewer);
    expect([200, 206]).toContain(full.status);
    expect(full.body.length ?? Number(full.headers['content-length'])).toBeGreaterThan(0);

    const ranged = await request(server)
      .get(`${prefix}/stream/${fileSession}/media`)
      .set('Cookie', viewer)
      .set('Range', 'bytes=0-99');
    expect(ranged.status).toBe(206);
    expect(ranged.headers['content-range']).toMatch(/^bytes 0-99\//);
    expect(Number(ranged.headers['content-length'])).toBe(100);
    expect(ranged.headers['accept-ranges']).toBe('bytes');

    const unpublished = await request(server)
      .patch(`${prefix}/admin/movies/${fileMovieId}`)
      .set('Cookie', admin)
      .send({ published: false });
    expect(unpublished.status).toBe(200);

    const staleMedia = await request(server)
      .get(`${prefix}/stream/${fileSession}/media`)
      .set('Cookie', viewer);
    expect([401, 404]).toContain(staleMedia.status);

    const staleBeat = await request(server)
      .post(`${prefix}/stream/${fileSession}/heartbeat`)
      .set('Cookie', viewer);
    expect([401, 404]).toContain(staleBeat.status);

    const replay = await request(server)
      .post(`${prefix}/movies/${fileMovieId}/playback`)
      .set('Cookie', viewer)
      .send({ quality: 'sd', deviceId: 'living-room' });
    expect(replay.status).toBe(404);
  });
});
