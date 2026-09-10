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

describe('Audio and subtitle tracks (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let mongod: MongoMemoryServer;
  let users: UsersService;
  let moviesDir: string;

  beforeAll(async () => {
    process.env.SUBSCRIPTION_REQUIRE_PAYMENT = 'false';
    process.env.MEDIA_PROBE = 'fake';
    moviesDir = await mkdtemp(path.join(os.tmpdir(), 'cv-tracks-'));
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
    const profileId = profiles.body.profiles[0].id as string;
    return cookieJar(
      await request(server).post(`${prefix}/profiles/${profileId}/select`).set('Cookie', cookies).send({}),
      cookies,
    );
  }

  async function waitScan(cookies: string, id: string) {
    for (let i = 0; i < 100; i++) {
      const res = await request(server).get(`${prefix}/admin/libraries/scans/${id}`).set('Cookie', cookies);
      const status = res.body.scan?.status as string;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        return res;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Timed out waiting for library scan.');
  }

  it('verifies tracks, converts SRT, and remembers profile language prefs', async () => {
    await seedUser('admin-tracks@example.com', UserRole.Admin);
    await seedUser('tracks-viewer@example.com');
    const admin = await login('admin-tracks@example.com');
    let viewer = await login('tracks-viewer@example.com');
    expect(
      (
        await request(server)
          .post(`${prefix}/subscriptions`)
          .set('Cookie', viewer)
          .send({ planSlug: 'basic', billingCycle: 'monthly' })
      ).status,
    ).toBe(201);
    viewer = await selectProfile(viewer);

    const profiles = await request(server).get(`${prefix}/profiles`).set('Cookie', viewer);
    const profileId = profiles.body.profiles[0].id as string;
    const prefs = await request(server)
      .patch(`${prefix}/profiles/${profileId}`)
      .set('Cookie', viewer)
      .send({ audioLanguage: 'hi', subtitleLanguage: 'bn' });
    expect(prefs.status).toBe(200);
    expect(prefs.body.profile.audioLanguage).toBe('hi');
    expect(prefs.body.profile.subtitleLanguage).toBe('bn');

    const movie = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Stream Dual',
        description: 'A dual-audio title used to verify language tracks.',
        releaseYear: 2024,
        runtimeMinutes: 101,
        genres: ['drama'],
        maturityRating: 'mature',
        published: true,
      });
    expect(movie.status).toBe(201);
    const movieId = movie.body.movie.id as string;

    await writeFile(path.join(moviesDir, 'Stream Dual (2024).480p.mp4'), Buffer.alloc(4096, 3));
    await writeFile(
      path.join(moviesDir, 'Stream Dual (2024).en.srt'),
      `1
00:00:01,000 --> 00:00:03,000
Hello <b>English</b>

2
00:00:04,000 --> 00:00:06,000
<script>alert(1)</script>Safe
`,
    );
    await writeFile(
      path.join(moviesDir, 'Stream Dual (2024).bn.vtt'),
      `WEBVTT

00:00:01.000 --> 00:00:03.000
Bangla subtitle
`,
    );
    await writeFile(path.join(moviesDir, 'Stream Dual (2024).hi.m4a'), Buffer.alloc(2048, 5));
    await writeFile(path.join(moviesDir, 'Stream Dual (2024).es.ass'), '[Script Info]\nTitle: unused\n');

    const library = await request(server)
      .post(`${prefix}/admin/libraries`)
      .set('Cookie', admin)
      .send({ name: 'Dual Audio Vault', kind: 'movies', rootPath: moviesDir });
    expect(library.status).toBe(201);
    const scan = await request(server)
      .post(`${prefix}/admin/libraries/scans`)
      .set('Cookie', admin)
      .send({});
    expect(scan.status).toBe(202);
    const done = await waitScan(admin, scan.body.scan.id);
    expect(done.body.scan.status).toBe('completed');

    const playback = await request(server)
      .post(`${prefix}/movies/${movieId}/playback`)
      .set('Cookie', viewer)
      .send({ quality: 'sd', deviceId: 'living-room' });
    expect(playback.status).toBe(200);
    expect(playback.body.session).toBeTruthy();
    assertNoPaths(playback.body);
    const session = playback.body.session;
    const audioHi = session.audioTracks.find(
      (item: { language: string; playable: boolean }) => item.language === 'hi' && item.playable,
    );
    const subBn = session.subtitleTracks.find(
      (item: { language: string; playable: boolean }) => item.language === 'bn' && item.playable,
    );
    const subEn = session.subtitleTracks.find(
      (item: { language: string; playable: boolean; format: string | null }) =>
        item.language === 'en' && item.playable && item.format === 'srt',
    );
    const subEs = session.subtitleTracks.find((item: { language: string }) => item.language === 'es');
    expect(audioHi?.playable).toBe(true);
    expect(audioHi?.codec).toBeTruthy();
    expect(session.selectedAudioId).toBe(audioHi.id);
    expect(subBn?.playable).toBe(true);
    expect(subBn?.format).toBe('vtt');
    expect(session.selectedSubtitleId).toBe(subBn.id);
    expect(subEn?.format).toBe('srt');
    expect(subEs?.playable).toBe(false);

    const embeddedAudio = session.audioTracks.find((item: { playable: boolean }) => !item.playable);
    expect(embeddedAudio).toBeTruthy();
    const blockedAudio = await request(server)
      .get(`${prefix}/stream/${session.id}/audio/${embeddedAudio.id}`)
      .set('Cookie', viewer);
    expect(blockedAudio.status).toBe(404);
    expect(blockedAudio.body.error).toBe(ErrorCode.AudioUnavailable);

    const vtt = await request(server)
      .get(`${prefix}/stream/${session.id}/subtitles/${subBn.id}`)
      .set('Cookie', viewer);
    expect(vtt.status).toBe(200);
    expect(String(vtt.headers['content-type'])).toMatch(/text\/vtt/i);
    expect(String(vtt.text)).toContain('WEBVTT');
    expect(String(vtt.text)).toContain('Bangla subtitle');
    expect(JSON.stringify(vtt.body)).not.toMatch(/C:\\|\/var\/|storage\//i);

    const srt = await request(server)
      .get(`${prefix}/stream/${session.id}/subtitles/${subEn.id}`)
      .set('Cookie', viewer);
    expect(srt.status).toBe(200);
    expect(String(srt.text)).toContain('WEBVTT');
    expect(String(srt.text)).toContain('<b>English</b>');
    expect(String(srt.text)).not.toContain('<script>');

    const anon = await request(server).get(`${prefix}/stream/${session.id}/subtitles/${subEn.id}`);
    expect(anon.status).toBe(401);

    const audio = await request(server)
      .get(`${prefix}/stream/${session.id}/audio/${audioHi.id}`)
      .set('Cookie', viewer);
    expect([200, 206]).toContain(audio.status);

    const switched = await request(server)
      .post(`${prefix}/stream/${session.id}/tracks`)
      .set('Cookie', viewer)
      .send({ subtitleId: subEn.id, audioId: audioHi.id });
    expect(switched.status).toBe(200);
    expect(switched.body.session.selectedSubtitleId).toBe(subEn.id);
    assertNoPaths(switched.body);

    const remembered = await request(server).get(`${prefix}/profiles/${profileId}`).set('Cookie', viewer);
    expect(remembered.body.profile.subtitleLanguage).toBe('en');
    expect(remembered.body.profile.audioLanguage).toBe('hi');

    const off = await request(server)
      .post(`${prefix}/stream/${session.id}/tracks`)
      .set('Cookie', viewer)
      .send({ subtitleId: null });
    expect(off.status).toBe(200);
    expect(off.body.session.selectedSubtitleId).toBeNull();
    const afterOff = await request(server).get(`${prefix}/profiles/${profileId}`).set('Cookie', viewer);
    expect(afterOff.body.profile.subtitleLanguage).toBe('off');

    const rememberedPlayback = await request(server)
      .post(`${prefix}/movies/${movieId}/playback`)
      .set('Cookie', viewer)
      .send({ quality: 'sd', deviceId: 'living-room' });
    expect(rememberedPlayback.status).toBe(200);
    expect(rememberedPlayback.body.session.selectedAudioId).toBe(audioHi.id);
    expect(rememberedPlayback.body.session.selectedSubtitleId).toBeNull();

    const missing = await request(server)
      .post(`${prefix}/stream/${session.id}/tracks`)
      .set('Cookie', viewer)
      .send({ audioId: 'aaaaaaaaaaaaaaaaaaaaaaaa' });
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe(ErrorCode.TrackNotFound);

    const unsupported = await request(server)
      .get(`${prefix}/stream/${session.id}/subtitles/${subEs.id}`)
      .set('Cookie', viewer);
    expect(unsupported.status).toBe(404);
    expect(unsupported.body.error).toBe(ErrorCode.SubtitleUnavailable);

    const detail = await request(server).get(`${prefix}/movies/${movieId}`).set('Cookie', viewer);
    expect(detail.body.audioTracks.some((item: { language: string }) => item.language === 'hi')).toBe(true);
    expect(detail.body.subtitleTracks.some((item: { format: string }) => item.format === 'srt')).toBe(true);
    assertNoPaths(detail.body);
  });
});
