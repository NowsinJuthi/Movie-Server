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

describe('Home browse (e2e)', () => {
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

  it('assembles a personalized Netflix-style home payload from catalog and profile data', async () => {
    await seedUser('admin-home@example.com', UserRole.Admin);
    await seedUser('home-viewer@example.com');
    await seedUser('home-broke@example.com');
    const admin = await login('admin-home@example.com');
    let viewer = await login('home-viewer@example.com');
    const broke = await login('home-broke@example.com');

    expect((await request(server).get(`${prefix}/home`)).status).toBe(401);
    expect((await request(server).get(`${prefix}/home`).set('Cookie', broke)).status).toBe(403);
    expect((await request(server).get(`${prefix}/home`).set('Cookie', broke)).body.error).toBe(
      ErrorCode.SubscriptionRequired,
    );

    const adminProfile = await request(server).post(`${prefix}/profiles`).set('Cookie', admin).send({ name: 'Staff' });
    expect(adminProfile.status).toBe(201);
    const adminHomeCookies = cookieJar(
      await request(server)
        .post(`${prefix}/profiles/${adminProfile.body.profile.id}/select`)
        .set('Cookie', admin)
        .send({}),
      admin,
    );
    const staffHome = await request(server).get(`${prefix}/home`).set('Cookie', adminHomeCookies);
    expect(staffHome.status).toBe(200);
    expect(staffHome.body.hero === null || typeof staffHome.body.hero === 'object').toBe(true);

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

    const featured = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Nebula Dawn',
        description: 'A gripping space opera about a lost fleet.',
        releaseYear: 2021,
        runtimeMinutes: 128,
        genres: ['scifi', 'drama'],
        maturityRating: 'mature',
        certification: 'PG-13',
        featured: true,
        trending: true,
        published: true,
        backdropUrl: 'https://example.com/nebula-back.jpg',
        posterUrl: 'https://example.com/nebula-poster.jpg',
      });
    expect(featured.status).toBe(201);
    const movieId = featured.body.movie.id as string;

    const popular = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Harbor Friends',
        description: 'A gentle story for younger viewers.',
        releaseYear: 2026,
        runtimeMinutes: 84,
        genres: ['family', 'animation'],
        maturityRating: 'kids',
        published: true,
        popular: true,
      });
    expect(popular.status).toBe(201);

    const series = await request(server)
      .post(`${prefix}/admin/series`)
      .set('Cookie', admin)
      .send({
        title: 'Harbor Nights',
        description: 'Detectives work the night shift on the waterfront.',
        firstAirYear: 2021,
        genres: ['drama', 'crime'],
        maturityRating: 'mature',
        featured: true,
        popular: true,
        published: true,
        backdropUrl: 'https://example.com/harbor-back.jpg',
      });
    expect(series.status).toBe(201);

    await request(server)
      .post(`${prefix}/profiles/${profileId}/list`)
      .set('Cookie', viewer)
      .send({ mediaId: movieId });
    await request(server)
      .post(`${prefix}/profiles/${profileId}/favorites`)
      .set('Cookie', viewer)
      .send({ mediaId: movieId, kind: 'movie' });
    await request(server)
      .put(`${prefix}/profiles/${profileId}/history`)
      .set('Cookie', viewer)
      .send({ mediaId: movieId, progressSeconds: 400, durationSeconds: 7200 });

    const home = await request(server).get(`${prefix}/home`).set('Cookie', viewer);
    expect(home.status).toBe(200);
    expect(String(home.headers['cache-control'])).toMatch(/private/);
    assertNoPaths(home.body);
    expect(home.body.hero?.title).toBe('Nebula Dawn');
    expect(home.body.myListIds).toContain(movieId);
    expect(home.body.favoriteIds).toContain(movieId);
    const rowIds = home.body.rows.map((row: { id: string }) => row.id);
    expect(rowIds).toEqual(
      expect.arrayContaining([
        'recently-watched',
        'featured',
        'trending',
        'popular-movies',
        'popular-series',
        'recent',
      ]),
    );
    expect(rowIds).not.toContain('continue');
    expect(rowIds).not.toContain('mylist');
    expect(rowIds).not.toContain('favorites');
    const recentlyWatchedRow = home.body.rows.find((row: { id: string }) => row.id === 'recently-watched');
    expect(recentlyWatchedRow.items.some((item: { id: string }) => item.id === movieId)).toBe(true);
    expect(home.body.rows.some((row: { kind: string }) => row.kind === 'genre')).toBe(true);
    expect(
      home.body.rows
        .find((row: { id: string }) => row.id === 'featured')
        .items.some((item: { title: string }) => item.title === 'Harbor Nights'),
    ).toBe(true);

    const kids = await request(server)
      .post(`${prefix}/profiles`)
      .set('Cookie', viewer)
      .send({ name: 'Home Kid', isKids: true });
    const kidsCookies = cookieJar(
      await request(server)
        .post(`${prefix}/profiles/${kids.body.profile.id}/select`)
        .set('Cookie', viewer)
        .send({}),
      viewer,
    );
    const kidsHome = await request(server).get(`${prefix}/home`).set('Cookie', kidsCookies);
    expect(kidsHome.status).toBe(200);
    const kidsTitles = JSON.stringify(kidsHome.body);
    expect(kidsTitles).not.toContain('Nebula Dawn');
    expect(kidsTitles).toContain('Harbor Friends');
    assertNoPaths(kidsHome.body);
  });
});
