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

describe('Search & discovery (e2e)', () => {
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

  it('searches titles, people, episodes, filters, history, and similar content', async () => {
    await seedUser('admin-search@example.com', UserRole.Admin);
    await seedUser('search-viewer@example.com');
    await seedUser('search-broke@example.com');
    const admin = await login('admin-search@example.com');
    let viewer = await login('search-viewer@example.com');
    const broke = await login('search-broke@example.com');

    expect((await request(server).get(`${prefix}/search`).query({ q: 'Nebula' })).status).toBe(401);
    expect((await request(server).get(`${prefix}/search`).query({ q: 'Nebula' }).set('Cookie', broke)).status).toBe(
      403,
    );

    expect(
      (
        await request(server)
          .post(`${prefix}/subscriptions`)
          .set('Cookie', viewer)
          .send({ planSlug: 'basic', billingCycle: 'monthly' })
      ).status,
    ).toBe(201);

    const profiles = await request(server).get(`${prefix}/profiles`).set('Cookie', viewer);
    const profileId = profiles.body.profiles[0].id as string;
    viewer = cookieJar(
      await request(server).post(`${prefix}/profiles/${profileId}/select`).set('Cookie', viewer).send({}),
      viewer,
    );

    const nebula = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Nebula Dawn',
        originalTitle: 'Amanecer de Nebula',
        description: 'A gripping space opera about a lost fleet.',
        releaseYear: 2021,
        runtimeMinutes: 128,
        genres: ['scifi', 'drama'],
        tags: ['space', 'fleet'],
        directors: ['Ada Vega'],
        writers: ['Jon Kite'],
        cast: [{ name: 'Rina Sol', character: 'Captain', order: 0 }],
        ratings: { imdb: 8.4, tmdb: 8.1 },
        maturityRating: 'mature',
        published: true,
        popular: true,
      });
    expect(nebula.status).toBe(201);
    const nebulaId = nebula.body.movie.id as string;

    const ion = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Ion Drift',
        description: 'Another space voyage with overlapping crew.',
        releaseYear: 2022,
        runtimeMinutes: 110,
        genres: ['scifi'],
        directors: ['Ada Vega'],
        cast: [{ name: 'Rina Sol', character: 'Pilot', order: 0 }],
        ratings: { imdb: 7.2 },
        maturityRating: 'mature',
        published: true,
      });
    expect(ion.status).toBe(201);
    const ionId = ion.body.movie.id as string;

    const kidsMovie = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Harbor Friends',
        description: 'A gentle story for younger viewers.',
        releaseYear: 2020,
        runtimeMinutes: 84,
        genres: ['family', 'animation'],
        maturityRating: 'kids',
        published: true,
        popular: true,
      });
    expect(kidsMovie.status).toBe(201);

    await request(server)
      .post(`${prefix}/admin/movies/${nebulaId}/media`)
      .set('Cookie', admin)
      .send({ kind: 'video', quality: '480p', language: 'en', label: 'SD', status: 'ready' });
    await request(server)
      .post(`${prefix}/admin/movies/${nebulaId}/media`)
      .set('Cookie', admin)
      .send({ kind: 'audio', language: 'en', label: 'English', status: 'ready' });
    await request(server)
      .post(`${prefix}/admin/movies/${nebulaId}/media`)
      .set('Cookie', admin)
      .send({ kind: 'audio', language: 'bn', label: 'Bangla', status: 'ready' });
    await request(server)
      .post(`${prefix}/admin/movies/${ionId}/media`)
      .set('Cookie', admin)
      .send({ kind: 'video', quality: '1080p', language: 'en', label: 'HD', status: 'ready' });

    const series = await request(server)
      .post(`${prefix}/admin/series`)
      .set('Cookie', admin)
      .send({
        title: 'Harbor Nights',
        originalTitle: 'Noches del Puerto',
        description: 'Detectives work the night shift on the waterfront.',
        firstAirYear: 2021,
        genres: ['drama', 'crime'],
        tags: ['waterfront'],
        directors: ['Mina Cole'],
        cast: [{ name: 'Joel Reed', character: 'Cal', order: 0 }],
        maturityRating: 'mature',
        published: true,
        featured: true,
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
        title: 'Night Watch',
        description: 'A body washes up under the pier.',
        runtimeMinutes: 48,
        published: true,
      });
    expect(episode.status).toBe(201);
    const episodeId = episode.body.episode.id as string;

    const byTitle = await request(server)
      .get(`${prefix}/search`)
      .query({ q: 'Nebula', commit: true, sort: 'relevance' })
      .set('Cookie', viewer);
    expect(byTitle.status).toBe(200);
    assertNoPaths(byTitle.body);
    expect(byTitle.body.movies.items.some((item: { title: string }) => item.title === 'Nebula Dawn')).toBe(true);
    expect(byTitle.body.total).toBeGreaterThan(0);

    const byOriginal = await request(server)
      .get(`${prefix}/search`)
      .query({ q: 'Amanecer' })
      .set('Cookie', viewer);
    expect(byOriginal.body.movies.items.some((item: { id: string }) => item.id === nebulaId)).toBe(true);

    const byActor = await request(server).get(`${prefix}/search`).query({ q: 'Rina' }).set('Cookie', viewer);
    expect(byActor.body.movies.items.some((item: { title: string }) => item.title === 'Nebula Dawn')).toBe(true);
    expect(byActor.body.people.some((item: { name: string }) => item.name.toLowerCase().includes('rina'))).toBe(true);

    const byDirector = await request(server).get(`${prefix}/search`).query({ q: 'Ada Vega' }).set('Cookie', viewer);
    expect(byDirector.body.movies.items.length).toBeGreaterThanOrEqual(1);

    const byGenre = await request(server)
      .get(`${prefix}/search`)
      .query({ q: 'scifi', kind: 'movie' })
      .set('Cookie', viewer);
    expect(byGenre.body.movies.items.some((item: { title: string }) => item.title === 'Nebula Dawn')).toBe(true);

    const byTag = await request(server).get(`${prefix}/search`).query({ q: 'space' }).set('Cookie', viewer);
    expect(byTag.body.movies.items.some((item: { id: string }) => item.id === nebulaId)).toBe(true);

    const episodes = await request(server)
      .get(`${prefix}/search`)
      .query({ q: 'Night Watch', kind: 'episode' })
      .set('Cookie', viewer);
    expect(episodes.body.episodes.items.some((item: { id: string; title: string }) => item.id === episodeId && item.title === 'Night Watch')).toBe(
      true,
    );

    const filtered = await request(server)
      .get(`${prefix}/search`)
      .query({ q: 'Nebula', genre: 'scifi', year: 2021, minRating: 8, language: 'en', audio: 'bn', quality: '480p' })
      .set('Cookie', viewer);
    expect(filtered.status).toBe(200);
    expect(filtered.body.movies.items).toHaveLength(1);
    expect(filtered.body.movies.items[0].id).toBe(nebulaId);

    const qualityMiss = await request(server)
      .get(`${prefix}/search`)
      .query({ q: 'Ion', quality: '480p' })
      .set('Cookie', viewer);
    expect(qualityMiss.body.movies.items.some((item: { id: string }) => item.id === ionId)).toBe(false);

    const paged = await request(server)
      .get(`${prefix}/search`)
      .query({ q: 'Rina', kind: 'movie', page: 1, limit: 1, sort: 'newest' })
      .set('Cookie', viewer);
    expect(paged.body.movies.items).toHaveLength(1);
    expect(paged.body.movies.total).toBeGreaterThanOrEqual(2);
    expect(paged.body.movies.nextPage).toBe(2);

    const suggest = await request(server).get(`${prefix}/search/suggest`).query({ q: 'Neb' }).set('Cookie', viewer);
    expect(suggest.status).toBe(200);
    expect(suggest.body.titles.some((item: { label: string }) => item.label.includes('Nebula'))).toBe(true);

    const history = await request(server).get(`${prefix}/profiles/${profileId}/search-history`).set('Cookie', viewer);
    expect(history.status).toBe(200);
    expect(history.body.items.some((item: { query: string }) => item.query.toLowerCase().includes('nebula'))).toBe(true);

    const second = await request(server)
      .post(`${prefix}/profiles`)
      .set('Cookie', viewer)
      .send({ name: 'Other' });
    const otherId = second.body.profile.id as string;
    const otherCookies = cookieJar(
      await request(server).post(`${prefix}/profiles/${otherId}/select`).set('Cookie', viewer).send({}),
      viewer,
    );
    const otherHistory = await request(server)
      .get(`${prefix}/profiles/${otherId}/search-history`)
      .set('Cookie', otherCookies);
    expect(otherHistory.body.items).toHaveLength(0);

    const recorded = await request(server)
      .post(`${prefix}/profiles/${otherId}/search-history`)
      .set('Cookie', otherCookies)
      .send({ query: 'Harbor', resultCount: 1 });
    expect(recorded.status).toBe(201);
    expect(recorded.body.items.some((item: { query: string }) => item.query === 'Harbor')).toBe(true);

    const cleared = await request(server)
      .delete(`${prefix}/profiles/${otherId}/search-history`)
      .set('Cookie', otherCookies);
    expect(cleared.status).toBe(200);
    expect(cleared.body.deleted).toBeGreaterThanOrEqual(1);

    const empty = await request(server)
      .get(`${prefix}/search`)
      .query({ q: 'zzzz-no-such-title', commit: true })
      .set('Cookie', viewer);
    expect(empty.body.total).toBe(0);
    expect(empty.body.recommendations.length).toBeGreaterThan(0);
    assertNoPaths(empty.body);

    const trending = await request(server).get(`${prefix}/search/trending`).set('Cookie', viewer);
    expect(trending.status).toBe(200);
    expect(trending.body.items.length).toBeGreaterThan(0);

    const similar = await request(server)
      .get(`${prefix}/search/similar/movies/${nebulaId}`)
      .set('Cookie', viewer);
    expect(similar.status).toBe(200);
    expect(similar.body.items.some((item: { id: string }) => item.id === ionId)).toBe(true);
    expect(similar.body.items.some((item: { id: string }) => item.id === nebulaId)).toBe(false);

    const kids = await request(server)
      .post(`${prefix}/profiles`)
      .set('Cookie', viewer)
      .send({ name: 'Search Kid', isKids: true });
    const kidsCookies = cookieJar(
      await request(server)
        .post(`${prefix}/profiles/${kids.body.profile.id}/select`)
        .set('Cookie', viewer)
        .send({}),
      viewer,
    );
    const kidsSearch = await request(server)
      .get(`${prefix}/search`)
      .query({ q: 'Nebula' })
      .set('Cookie', kidsCookies);
    expect(kidsSearch.status).toBe(200);
    expect(JSON.stringify(kidsSearch.body)).not.toContain('Nebula Dawn');
    const kidsFamily = await request(server)
      .get(`${prefix}/search`)
      .query({ q: 'Harbor Friends' })
      .set('Cookie', kidsCookies);
    expect(kidsFamily.body.movies.items.some((item: { title: string }) => item.title === 'Harbor Friends')).toBe(
      true,
    );
    assertNoPaths(kidsSearch.body);
  });
});
