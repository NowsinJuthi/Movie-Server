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

describe('Movies (e2e)', () => {
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
    if (app) {
      await app.close();
    }
    if (mongod) {
      await mongod.stop();
    }
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

  async function subscribe(cookies: string, planSlug = 'basic') {
    const res = await request(server)
      .post(`${prefix}/subscriptions`)
      .set('Cookie', cookies)
      .send({ planSlug, billingCycle: 'monthly' });
    expect(res.status).toBe(201);
    return res;
  }

  it('hides unpublished movies, enforces subscription, and never leaks filesystem paths', async () => {
    await seedUser('admin-movies@example.com', UserRole.Admin);
    await seedUser('viewer@example.com');
    await seedUser('broke@example.com');
    const admin = await login('admin-movies@example.com');
    const viewer = await login('viewer@example.com');
    const broke = await login('broke@example.com');
    await subscribe(viewer, 'basic');

    const rejectedPath = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Path Leak',
        description: 'Should fail validation.',
        releaseYear: 2024,
        runtimeMinutes: 100,
        genres: ['drama'],
        maturityRating: 'mature',
        posterUrl: 'C:\\Movies\\poster.jpg',
      });
    expect(rejectedPath.status).toBe(400);

    const rejectedMediaPath = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Ok Title',
        description: 'A valid description for the catalog.',
        releaseYear: 2024,
        runtimeMinutes: 100,
        genres: ['drama'],
        maturityRating: 'mature',
        storagePath: '/var/media/film.mkv',
      });
    expect(rejectedMediaPath.status).toBe(400);

    const created = await request(server)
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
        maturityRating: 'mature',
        certification: 'PG-13',
        featured: true,
        published: false,
        trailerUrl: 'https://example.com/trailer.mp4',
      });
    expect(created.status).toBe(201);
    const movieId = created.body.movie.id as string;
    assertNoPaths(created.body);

    const hidden = await request(server).get(`${prefix}/movies/${movieId}`).set('Cookie', viewer);
    expect(hidden.status).toBe(404);
    expect(hidden.body.error).toBe(ErrorCode.MovieNotFound);

    const listedHidden = await request(server).get(`${prefix}/movies`).set('Cookie', viewer);
    expect(listedHidden.status).toBe(200);
    expect(listedHidden.body.items).toHaveLength(0);

    const nosub = await request(server).get(`${prefix}/movies`).set('Cookie', broke);
    expect(nosub.status).toBe(403);
    expect(nosub.body.error).toBe(ErrorCode.SubscriptionRequired);

    const bulk = await request(server)
      .post(`${prefix}/admin/movies/bulk`)
      .set('Cookie', admin)
      .send({ ids: [movieId], action: 'publish' });
    expect(bulk.status).toBe(201);
    expect(bulk.body.matched).toBeGreaterThanOrEqual(1);

    const visible = await request(server).get(`${prefix}/movies/${movieId}`).set('Cookie', viewer);
    expect(visible.status).toBe(200);
    expect(visible.body.movie.title).toBe('Nebula Dawn');
    expect(visible.body.movie.published).toBe(true);
    assertNoPaths(visible.body);

    const searched = await request(server)
      .get(`${prefix}/movies`)
      .query({ q: 'Nebula', genre: 'scifi', sort: 'title', page: 1, limit: 10 })
      .set('Cookie', viewer);
    expect(searched.status).toBe(200);
    expect(searched.body.items).toHaveLength(1);
    expect(searched.body.total).toBe(1);
    expect(searched.body.page).toBe(1);

    const family = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Harbor Friends',
        description: 'A gentle story for younger viewers.',
        releaseYear: 2020,
        runtimeMinutes: 84,
        genres: ['family', 'animation'],
        tags: ['kindness'],
        maturityRating: 'kids',
        published: true,
        popular: true,
      });
    expect(family.status).toBe(201);

    const paged = await request(server)
      .get(`${prefix}/movies`)
      .query({ page: 1, limit: 1, sort: 'title' })
      .set('Cookie', viewer);
    expect(paged.body.items).toHaveLength(1);
    expect(paged.body.totalPages).toBeGreaterThanOrEqual(2);

    const catalog = await request(server).get(`${prefix}/movies/catalog`).set('Cookie', viewer);
    expect(catalog.status).toBe(200);
    expect(catalog.body.featured.some((item: { title: string }) => item.title === 'Nebula Dawn')).toBe(true);
    assertNoPaths(catalog.body);

    const v480 = await request(server)
      .post(`${prefix}/admin/movies/${movieId}/media`)
      .set('Cookie', admin)
      .send({ kind: 'video', quality: '480p', language: 'en', label: 'SD', status: 'ready' });
    expect(v480.status).toBe(201);
    assertNoPaths(v480.body);
    expect(v480.body.asset.storageKey).toMatch(/^[a-f0-9]{32}$/);
    expect(v480.body.asset.storagePath).toBeUndefined();

    const v4k = await request(server)
      .post(`${prefix}/admin/movies/${movieId}/media`)
      .set('Cookie', admin)
      .send({ kind: 'video', quality: '4k', language: 'en', label: 'UHD', status: 'ready' });
    expect(v4k.status).toBe(201);

    await request(server)
      .post(`${prefix}/admin/movies/${movieId}/media`)
      .set('Cookie', admin)
      .send({ kind: 'audio', language: 'en', label: 'English', status: 'ready', isDefault: true });
    await request(server)
      .post(`${prefix}/admin/movies/${movieId}/media`)
      .set('Cookie', admin)
      .send({ kind: 'subtitle', language: 'es', label: 'Spanish', status: 'ready' });

    const detail = await request(server).get(`${prefix}/movies/${movieId}`).set('Cookie', viewer);
    expect(detail.status).toBe(200);
    expect(detail.body.versions).toHaveLength(2);
    const sd = detail.body.versions.find((item: { quality: string }) => item.quality === '480p');
    const uhd = detail.body.versions.find((item: { quality: string }) => item.quality === '4k');
    expect(sd.allowed).toBe(true);
    expect(uhd.allowed).toBe(false);
    expect(detail.body.audioTracks).toHaveLength(1);
    expect(detail.body.subtitleTracks).toHaveLength(1);
    expect(detail.body.movie.maxResolution).toBe('480p');
    expect(detail.body.movie.playable).toBe(true);
    assertNoPaths(detail.body);

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

    const kidsList = await request(server).get(`${prefix}/movies`).set('Cookie', kidsCookies);
    expect(kidsList.status).toBe(200);
    expect(kidsList.body.items.map((item: { title: string }) => item.title)).toEqual(['Harbor Friends']);

    const kidsDetail = await request(server).get(`${prefix}/movies/${movieId}`).set('Cookie', kidsCookies);
    expect(kidsDetail.status).toBe(404);
  });
});
