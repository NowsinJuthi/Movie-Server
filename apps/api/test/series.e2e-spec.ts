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

function assertNoPaths(body: unknown) {
  expect(JSON.stringify(body)).not.toMatch(/C:\\|\/var\/|\/home\/|storage\/uploads/i);
}

describe('Series (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let mongod: MongoMemoryServer;
  let users: UsersService;

  beforeAll(async () => {
    process.env.SUBSCRIPTION_REQUIRE_PAYMENT = 'false';
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

  it('covers Series → Season → Episode → Playback → Progress → Watched', async () => {
    await seedUser('admin-series@example.com', UserRole.Admin);
    await seedUser('series-viewer@example.com');
    await seedUser('series-broke@example.com');
    const admin = await login('admin-series@example.com');
    let viewer = await login('series-viewer@example.com');
    const broke = await login('series-broke@example.com');

    const sub = await request(server)
      .post(`${prefix}/subscriptions`)
      .set('Cookie', viewer)
      .send({ planSlug: 'basic', billingCycle: 'monthly' });
    expect(sub.status).toBe(201);

    const profiles = await request(server).get(`${prefix}/profiles`).set('Cookie', viewer);
    expect(profiles.status).toBe(200);
    const profileId = profiles.body.profiles[0].id as string;
    viewer = cookieJar(
      await request(server).post(`${prefix}/profiles/${profileId}/select`).set('Cookie', viewer).send({}),
      viewer,
    );

    const rejected = await request(server)
      .post(`${prefix}/admin/series`)
      .set('Cookie', admin)
      .send({
        title: 'Path Show',
        description: 'Should reject filesystem paths.',
        firstAirYear: 2022,
        genres: ['drama'],
        maturityRating: 'mature',
        posterUrl: 'C:\\Shows\\poster.jpg',
      });
    expect(rejected.status).toBe(400);

    const created = await request(server)
      .post(`${prefix}/admin/series`)
      .set('Cookie', admin)
      .send({
        title: 'Harbor Nights',
        description: 'Detectives work the night shift on the waterfront.',
        firstAirYear: 2021,
        genres: ['drama', 'crime'],
        tags: ['waterfront'],
        directors: ['Mina Cole'],
        cast: [{ name: 'Joel Reed', character: 'Cal', order: 0 }],
        maturityRating: 'mature',
        featured: true,
        published: false,
        autoPlayNext: true,
      });
    expect(created.status).toBe(201);
    const seriesId = created.body.series.id as string;
    assertNoPaths(created.body);

    const hidden = await request(server).get(`${prefix}/series/${seriesId}`).set('Cookie', viewer);
    expect(hidden.status).toBe(404);
    expect(hidden.body.error).toBe(ErrorCode.SeriesNotFound);

    const nosub = await request(server).get(`${prefix}/series`).set('Cookie', broke);
    expect(nosub.status).toBe(403);
    expect(nosub.body.error).toBe(ErrorCode.SubscriptionRequired);

    await request(server)
      .post(`${prefix}/admin/series/bulk`)
      .set('Cookie', admin)
      .send({ ids: [seriesId], action: 'publish' });

    const season = await request(server)
      .post(`${prefix}/admin/series/${seriesId}/seasons`)
      .set('Cookie', admin)
      .send({ seasonNumber: 1, name: 'Season 1', description: 'The first year.', published: true });
    expect(season.status).toBe(201);
    const seasonId = season.body.season.id as string;

    const ep1 = await request(server)
      .post(`${prefix}/admin/series/${seriesId}/seasons/${seasonId}/episodes`)
      .set('Cookie', admin)
      .send({
        episodeNumber: 1,
        title: 'Night Watch',
        description: 'A body washes up under the pier.',
        runtimeMinutes: 48,
        published: true,
        airDate: '2021-03-12',
      });
    expect(ep1.status).toBe(201);
    const episodeId = ep1.body.episode.id as string;

    const batch = await request(server)
      .post(`${prefix}/admin/series/${seriesId}/seasons/${seasonId}/episodes/batch`)
      .set('Cookie', admin)
      .send({
        episodes: [
          {
            episodeNumber: 2,
            title: 'Low Tide',
            description: 'The investigation reaches the docks.',
            runtimeMinutes: 46,
            published: false,
          },
        ],
      });
    expect(batch.status).toBe(201);
    const episode2Id = batch.body.episodes[0].id as string;

    const bulk = await request(server)
      .post(`${prefix}/admin/series/${seriesId}/seasons/${seasonId}/episodes/bulk`)
      .set('Cookie', admin)
      .send({ ids: [episode2Id], action: 'publish' });
    expect(bulk.status).toBe(201);

    const mediaSd = await request(server)
      .post(`${prefix}/admin/series/${seriesId}/seasons/${seasonId}/episodes/${episodeId}/media`)
      .set('Cookie', admin)
      .send({ kind: 'video', quality: '480p', language: 'en', label: 'SD', status: 'ready' });
    expect(mediaSd.status).toBe(201);
    expect(mediaSd.body.asset.episodeId).toBe(episodeId);
    expect(mediaSd.body.asset.storagePath).toBeUndefined();
    assertNoPaths(mediaSd.body);

    await request(server)
      .post(`${prefix}/admin/series/${seriesId}/seasons/${seasonId}/episodes/${episodeId}/media`)
      .set('Cookie', admin)
      .send({ kind: 'video', quality: '4k', language: 'en', label: 'UHD', status: 'ready' });
    await request(server)
      .post(`${prefix}/admin/series/${seriesId}/seasons/${seasonId}/episodes/${episodeId}/media`)
      .set('Cookie', admin)
      .send({ kind: 'audio', language: 'en', label: 'English', status: 'ready' });
    await request(server)
      .post(`${prefix}/admin/series/${seriesId}/seasons/${seasonId}/episodes/${episodeId}/media`)
      .set('Cookie', admin)
      .send({ kind: 'subtitle', language: 'es', label: 'Spanish', status: 'ready' });

    const listed = await request(server)
      .get(`${prefix}/series`)
      .query({ q: 'Harbor', genre: 'drama', sort: 'title', page: 1, limit: 10 })
      .set('Cookie', viewer);
    expect(listed.status).toBe(200);
    expect(listed.body.items).toHaveLength(1);

    const detail = await request(server).get(`${prefix}/series/${seriesId}`).set('Cookie', viewer);
    expect(detail.status).toBe(200);
    expect(detail.body.seasons).toHaveLength(1);

    const seasonDetail = await request(server)
      .get(`${prefix}/series/${seriesId}/seasons/${seasonId}`)
      .set('Cookie', viewer);
    expect(seasonDetail.status).toBe(200);
    expect(seasonDetail.body.episodes).toHaveLength(2);

    const episode = await request(server)
      .get(`${prefix}/series/${seriesId}/episodes/${episodeId}`)
      .set('Cookie', viewer);
    expect(episode.status).toBe(200);
    expect(episode.body.episode.title).toBe('Night Watch');
    expect(episode.body.previous).toBeNull();
    expect(episode.body.next.episodeNumber).toBe(2);
    expect(episode.body.autoPlayNext).toBe(true);
    const sd = episode.body.versions.find((item: { quality: string }) => item.quality === '480p');
    const uhd = episode.body.versions.find((item: { quality: string }) => item.quality === '4k');
    expect(sd.allowed).toBe(true);
    expect(uhd.allowed).toBe(false);
    expect(episode.body.audioTracks).toHaveLength(1);
    expect(episode.body.subtitleTracks).toHaveLength(1);
    expect(episode.body.episode.playable).toBe(true);
    assertNoPaths(episode.body);

    const playback = await request(server)
      .post(`${prefix}/series/${seriesId}/episodes/${episodeId}/playback`)
      .set('Cookie', viewer)
      .send({ quality: 'sd' });
    expect(playback.status).toBe(200);
    expect(playback.body.allowed).toBe(true);

    const uhdPlayback = await request(server)
      .post(`${prefix}/series/${seriesId}/episodes/${episodeId}/playback`)
      .set('Cookie', viewer)
      .send({ quality: 'uhd' });
    expect(uhdPlayback.status).toBe(403);
    expect(uhdPlayback.body.error).toBe(ErrorCode.QualityNotAllowed);

    const progress = await request(server)
      .put(`${prefix}/series/${seriesId}/episodes/${episodeId}/progress`)
      .set('Cookie', viewer)
      .send({ progressSeconds: 120, durationSeconds: 2880 });
    expect(progress.status).toBe(200);
    expect(progress.body.progress.completed).toBe(false);
    expect(progress.body.episode.watched).toBe(false);

    const cont = await request(server).get(`${prefix}/series/continue-watching`).set('Cookie', viewer);
    expect(cont.status).toBe(200);
    expect(cont.body.items[0].episode.id).toBe(episodeId);
    expect(cont.body.items[0].series.title).toBe('Harbor Nights');

    const done = await request(server)
      .put(`${prefix}/series/${seriesId}/episodes/${episodeId}/progress`)
      .set('Cookie', viewer)
      .send({ progressSeconds: 2800, durationSeconds: 2880 });
    expect(done.status).toBe(200);
    expect(done.body.progress.completed).toBe(true);
    expect(done.body.episode.watched).toBe(true);
    expect(done.body.next.id).toBe(episode2Id);

    const afterComplete = await request(server)
      .get(`${prefix}/series/continue-watching`)
      .set('Cookie', viewer);
    expect(afterComplete.body.items).toHaveLength(0);

    const unwatch = await request(server)
      .delete(`${prefix}/series/${seriesId}/episodes/${episodeId}/watched`)
      .set('Cookie', viewer);
    expect(unwatch.status).toBe(200);
    expect(unwatch.body.episode.watched).toBe(false);

    const watch = await request(server)
      .post(`${prefix}/series/${seriesId}/episodes/${episodeId}/watched`)
      .set('Cookie', viewer);
    expect(watch.status).toBe(200);
    expect(watch.body.episode.watched).toBe(true);

    const catalog = await request(server).get(`${prefix}/series/catalog`).set('Cookie', viewer);
    expect(catalog.body.featured.some((item: { title: string }) => item.title === 'Harbor Nights')).toBe(true);

    await request(server).get(`${prefix}/profiles`).set('Cookie', viewer);
    const kidsProfile = await request(server)
      .post(`${prefix}/profiles`)
      .set('Cookie', viewer)
      .send({ name: 'Kiddo', isKids: true });
    expect(kidsProfile.status).toBe(201);
    const kidsCookies = cookieJar(
      await request(server)
        .post(`${prefix}/profiles/${kidsProfile.body.profile.id}/select`)
        .set('Cookie', viewer)
        .send({}),
      viewer,
    );
    const kidsList = await request(server).get(`${prefix}/series`).set('Cookie', kidsCookies);
    expect(kidsList.body.items).toHaveLength(0);
    const kidsDetail = await request(server).get(`${prefix}/series/${seriesId}`).set('Cookie', kidsCookies);
    expect(kidsDetail.status).toBe(404);
  });
});
