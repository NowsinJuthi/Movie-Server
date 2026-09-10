import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Server } from 'http';
import { mkdtemp, mkdir, writeFile, unlink, rm, copyFile } from 'fs/promises';
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

describe('Media library (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let mongod: MongoMemoryServer;
  let users: UsersService;
  let moviesDir: string;
  let tvDir: string;

  beforeAll(async () => {
    process.env.SUBSCRIPTION_REQUIRE_PAYMENT = 'false';
    process.env.MEDIA_PROBE = 'fake';
    moviesDir = await mkdtemp(path.join(os.tmpdir(), 'cv-lib-movies-'));
    tvDir = await mkdtemp(path.join(os.tmpdir(), 'cv-lib-tv-'));
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
    await rm(tvDir, { recursive: true, force: true });
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

  async function waitScan(cookies: string, id: string) {
    for (let i = 0; i < 100; i++) {
      const res = await request(server).get(`${prefix}/admin/libraries/scans/${id}`).set('Cookie', cookies);
      expect(res.status).toBe(200);
      assertNoPaths(res.body);
      const status = res.body.scan?.status as string;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        return res;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Timed out waiting for library scan.');
  }

  it('scans libraries, matches catalog titles, marks missing files, and never leaks paths', async () => {
    await seedUser('admin-library@example.com', UserRole.Admin);
    await seedUser('library-user@example.com');
    const admin = await login('admin-library@example.com');
    const viewer = await login('library-user@example.com');

    const denied = await request(server).get(`${prefix}/admin/libraries`).set('Cookie', viewer);
    expect(denied.status).toBe(403);

    const traversal = await request(server)
      .post(`${prefix}/admin/libraries`)
      .set('Cookie', admin)
      .send({ name: 'Bad', kind: 'movies', rootPath: '../secret' });
    expect(traversal.status).toBe(400);
    expect(traversal.body.error).toBe(ErrorCode.InvalidLibraryPath);

    const systemDir = await request(server)
      .post(`${prefix}/admin/libraries`)
      .set('Cookie', admin)
      .send({ name: 'System', kind: 'movies', rootPath: 'C:\\Windows' });
    expect(systemDir.status).toBe(400);
    expect(systemDir.body.error).toBe(ErrorCode.InvalidLibraryPath);

    const movie = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Nebula Dawn',
        description: 'A gripping space opera about a lost fleet.',
        releaseYear: 2021,
        runtimeMinutes: 128,
        genres: ['scifi'],
        maturityRating: 'mature',
        published: true,
      });
    expect(movie.status).toBe(201);
    const movieId = movie.body.movie.id as string;

    const series = await request(server)
      .post(`${prefix}/admin/series`)
      .set('Cookie', admin)
      .send({
        title: 'Harbor Nights',
        description: 'Detectives work the night shift on the waterfront.',
        firstAirYear: 2021,
        genres: ['drama'],
        maturityRating: 'mature',
        published: true,
      });
    expect(series.status).toBe(201);
    const seriesId = series.body.series.id as string;
    const season = await request(server)
      .post(`${prefix}/admin/series/${seriesId}/seasons`)
      .set('Cookie', admin)
      .send({ seasonNumber: 1, name: 'Season 1', published: true });
    expect(season.status).toBe(201);
    const seasonId = season.body.season.id as string;
    const episode = await request(server)
      .post(`${prefix}/admin/series/${seriesId}/seasons/${seasonId}/episodes`)
      .set('Cookie', admin)
      .send({
        episodeNumber: 1,
        title: 'Night Watch',
        description: 'A body washes up under the pier.',
        runtimeMinutes: 48,
        published: true,
      });
    expect(episode.status).toBe(201);
    const episodeId = episode.body.episode.id as string;

    const movieFile = path.join(moviesDir, 'Nebula Dawn (2021).1080p.mkv');
    const episodeFile = path.join(tvDir, 'Harbor Nights', 'Season 01', 'Harbor Nights - S01E01 - Night Watch.mkv');
    await mkdir(path.dirname(episodeFile), { recursive: true });
    const payload = Buffer.alloc(4096, 7);
    await writeFile(movieFile, payload);
    await writeFile(episodeFile, Buffer.alloc(4096, 9));

    const moviesLib = await request(server)
      .post(`${prefix}/admin/libraries`)
      .set('Cookie', admin)
      .send({ name: 'Movie Vault', kind: 'movies', rootPath: moviesDir });
    expect(moviesLib.status).toBe(201);
    assertNoPaths(moviesLib.body);
    expect(moviesLib.body.library.rootPath).toBeUndefined();
    expect(moviesLib.body.library.rootLabel).toBeTruthy();
    const moviesLibId = moviesLib.body.library.id as string;

    const tvLib = await request(server)
      .post(`${prefix}/admin/libraries`)
      .set('Cookie', admin)
      .send({ name: 'TV Vault', kind: 'tv', rootPath: tvDir });
    expect(tvLib.status).toBe(201);
    assertNoPaths(tvLib.body);
    const tvLibId = tvLib.body.library.id as string;

    const started = await request(server)
      .post(`${prefix}/admin/libraries/scans`)
      .set('Cookie', admin)
      .send({});
    expect(started.status).toBe(202);
    expect(['queued', 'running']).toContain(started.body.scan.status);
    const scanId = started.body.scan.id as string;
    assertNoPaths(started.body);

    const finished = await waitScan(admin, scanId);
    expect(finished.body.scan.status).toBe('completed');
    expect(finished.body.scan.matched).toBeGreaterThanOrEqual(2);

    const movieItems = await request(server)
      .get(`${prefix}/admin/libraries/${moviesLibId}/items`)
      .set('Cookie', admin);
    expect(movieItems.status).toBe(200);
    assertNoPaths(movieItems.body);
    expect(movieItems.body.items).toHaveLength(1);
    const movieItem = movieItems.body.items[0];
    expect(movieItem.status).toBe('ready');
    expect(movieItem.match).toBe('movie');
    expect(movieItem.movieId).toBe(movieId);
    expect(movieItem.fileName).toBe('Nebula Dawn (2021).1080p.mkv');
    expect(movieItem.probe.resolution).toBe('1080p');
    expect(movieItem.probe.videoCodec).toBe('h264');
    expect(movieItem.probe.audioTracks.length).toBeGreaterThan(0);
    expect(movieItem.probe.subtitleTracks.length).toBeGreaterThan(0);
    expect(movieItem.probe.durationMs).toBeGreaterThan(0);
    expect(movieItem.probe.sizeBytes).toBe(4096);

    const tvItems = await request(server)
      .get(`${prefix}/admin/libraries/${tvLibId}/items`)
      .set('Cookie', admin);
    expect(tvItems.status).toBe(200);
    assertNoPaths(tvItems.body);
    expect(tvItems.body.items[0].status).toBe('ready');
    expect(tvItems.body.items[0].match).toBe('episode');
    expect(tvItems.body.items[0].episodeId).toBe(episodeId);

    const movieDetail = await request(server).get(`${prefix}/admin/movies/${movieId}`).set('Cookie', admin);
    expect(movieDetail.status).toBe(200);
    assertNoPaths(movieDetail.body);
    const video = movieDetail.body.assets.find((asset: { kind: string }) => asset.kind === 'video');
    expect(video.status).toBe('ready');
    expect(video.quality).toBe('1080p');
    expect(video.codec).toBe('h264');
    expect(video.bitrateKbps).toBeGreaterThan(0);
    expect(video.storagePath).toBeUndefined();

    const episodeDetail = await request(server)
      .get(`${prefix}/admin/series/${seriesId}/seasons/${seasonId}/episodes/${episodeId}`)
      .set('Cookie', admin);
    expect(episodeDetail.status).toBe(200);
    assertNoPaths(episodeDetail.body);
    const epVideo = episodeDetail.body.assets.find((asset: { kind: string }) => asset.kind === 'video');
    expect(epVideo.status).toBe('ready');
    expect(epVideo.episodeId).toBe(episodeId);

    const logs = await request(server).get(`${prefix}/admin/libraries/scans/${scanId}/logs`).set('Cookie', admin);
    expect(logs.status).toBe(200);
    assertNoPaths(logs.body);
    expect(logs.body.logs.length).toBeGreaterThan(0);

    const duplicatePath = path.join(moviesDir, 'copy-of-nebula.mkv');
    await copyFile(movieFile, duplicatePath);
    const dupScan = await request(server)
      .post(`${prefix}/admin/libraries/scans`)
      .set('Cookie', admin)
      .send({ libraryId: moviesLibId, full: true });
    expect(dupScan.status).toBe(202);
    const dupDone = await waitScan(admin, dupScan.body.scan.id);
    expect(dupDone.body.scan.status).toBe('completed');
    expect(dupDone.body.scan.duplicates).toBeGreaterThanOrEqual(1);
    const afterDup = await request(server)
      .get(`${prefix}/admin/libraries/${moviesLibId}/items`)
      .set('Cookie', admin);
    expect(afterDup.body.items).toHaveLength(1);

    await unlink(movieFile);
    const missingScan = await request(server)
      .post(`${prefix}/admin/libraries/scans`)
      .set('Cookie', admin)
      .send({ libraryId: moviesLibId, full: true });
    expect(missingScan.status).toBe(202);
    const missingDone = await waitScan(admin, missingScan.body.scan.id);
    expect(missingDone.body.scan.status).toBe('completed');
    expect(missingDone.body.scan.missing).toBeGreaterThanOrEqual(1);

    const missingItems = await request(server)
      .get(`${prefix}/admin/libraries/${moviesLibId}/items`)
      .set('Cookie', admin);
    const missingItem = missingItems.body.items.find((item: { fileName: string }) =>
      item.fileName.includes('Nebula Dawn'),
    );
    expect(missingItem.status).toBe('missing');

    const missingMovie = await request(server).get(`${prefix}/admin/movies/${movieId}`).set('Cookie', admin);
    const missingVideo = missingMovie.body.assets.find((asset: { kind: string }) => asset.kind === 'video');
    expect(missingVideo.status).toBe('missing');
    assertNoPaths(missingMovie.body);
  });

  it('auto-imports unmatched movies into the catalog with local posters', async () => {
    await seedUser('admin-auto-import@example.com', UserRole.Admin);
    const admin = await login('admin-auto-import@example.com');
    const importDir = await mkdtemp(path.join(os.tmpdir(), 'cv-lib-auto-'));
    try {
      await writeFile(path.join(importDir, 'Solo Probe (2019).mkv'), Buffer.alloc(4096, 3));
      await writeFile(path.join(importDir, 'poster.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

      const created = await request(server)
        .post(`${prefix}/admin/libraries`)
        .set('Cookie', admin)
        .send({ name: 'Auto Import Vault', kind: 'movies', rootPath: importDir });
      expect(created.status).toBe(201);
      const libraryId = created.body.library.id as string;

      const started = await request(server)
        .post(`${prefix}/admin/libraries/scans`)
        .set('Cookie', admin)
        .send({ libraryId, full: true });
      expect(started.status).toBe(202);
      const finished = await waitScan(admin, started.body.scan.id);
      expect(finished.body.scan.status).toBe('completed');
      expect(finished.body.scan.matched).toBeGreaterThanOrEqual(1);

      const items = await request(server)
        .get(`${prefix}/admin/libraries/${libraryId}/items`)
        .set('Cookie', admin);
      expect(items.body.items[0].status).toBe('ready');
      expect(items.body.items[0].match).toBe('movie');
      expect(items.body.items[0].matchTitle).toBe('Solo Probe');

      const catalog = await request(server)
        .get(`${prefix}/admin/movies`)
        .query({ q: 'Solo Probe' })
        .set('Cookie', admin);
      expect(catalog.status).toBe(200);
      const movie = catalog.body.items.find((item: { title: string }) => item.title === 'Solo Probe');
      expect(movie).toBeTruthy();
      expect(movie.published).toBe(true);
      expect(movie.posterUrl).toMatch(/\/api\/v1\/media\/artwork\//);
      assertNoPaths(catalog.body);
    } finally {
      await rm(importDir, { recursive: true, force: true });
    }
  });
});
