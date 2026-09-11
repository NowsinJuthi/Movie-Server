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

describe('Watch and personalization (e2e)', () => {
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

  it('keeps favorites, reactions, ratings, history, and recommendations isolated per profile', async () => {
    await seedUser('admin-pers@example.com', UserRole.Admin);
    await seedUser('pers-viewer@example.com');
    await seedUser('pers-other@example.com');
    const admin = await login('admin-pers@example.com');
    let viewer = await login('pers-viewer@example.com');
    const other = await login('pers-other@example.com');

    expect((await request(server).get(`${prefix}/profiles/000000000000000000000001/personalization`)).status).toBe(401);

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

    const movieA = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Ion Horizon',
        description: 'A scout ship maps a dying star.',
        releaseYear: 2022,
        runtimeMinutes: 110,
        genres: ['scifi', 'drama'],
        cast: [{ name: 'Rina Sol', character: 'Captain' }],
        directors: ['Ada Vega'],
        maturityRating: 'mature',
        published: true,
        featured: true,
      });
    const movieB = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Ion Wake',
        description: 'The same crew hunts a signal beyond the heliopause.',
        releaseYear: 2023,
        runtimeMinutes: 118,
        genres: ['scifi', 'thriller'],
        cast: [{ name: 'Rina Sol', character: 'Captain' }],
        directors: ['Ada Vega'],
        maturityRating: 'mature',
        published: true,
        popular: true,
      });
    const kidsMovie = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Harbor Pals',
        description: 'Friendly boats learn to share the dock.',
        releaseYear: 2024,
        runtimeMinutes: 72,
        genres: ['family', 'animation'],
        maturityRating: 'kids',
        published: true,
      });
    expect(movieA.status).toBe(201);
    expect(movieB.status).toBe(201);
    expect(kidsMovie.status).toBe(201);
    const idA = movieA.body.movie.id as string;
    const idB = movieB.body.movie.id as string;
    const idKids = kidsMovie.body.movie.id as string;

    const history = await request(server)
      .put(`${prefix}/profiles/${profileId}/history`)
      .set('Cookie', viewer)
      .send({ mediaId: idA, progressSeconds: 400, durationSeconds: 6600 });
    expect(history.status).toBe(200);
    expect(history.body.item.completed).toBe(false);

    const favorite = await request(server)
      .post(`${prefix}/profiles/${profileId}/favorites`)
      .set('Cookie', viewer)
      .send({ mediaId: idA, kind: 'movie' });
    expect(favorite.status).toBe(201);

    const liked = await request(server)
      .put(`${prefix}/profiles/${profileId}/reactions`)
      .set('Cookie', viewer)
      .send({ mediaId: idA, kind: 'movie', reaction: 'like' });
    expect(liked.status).toBe(200);
    expect(liked.body.item.reaction).toBe('like');

    const rated = await request(server)
      .put(`${prefix}/profiles/${profileId}/ratings`)
      .set('Cookie', viewer)
      .send({ mediaId: idA, kind: 'movie', rating: 5 });
    expect(rated.status).toBe(200);
    expect(rated.body.item.rating).toBe(5);

    const personalization = await request(server)
      .get(`${prefix}/profiles/${profileId}/personalization`)
      .set('Cookie', viewer);
    expect(personalization.status).toBe(200);
    expect(personalization.body.favoriteIds).toContain(idA);
    expect(personalization.body.reactions[0].reaction).toBe('like');
    expect(personalization.body.ratings[0].rating).toBe(5);
    assertNoPaths(personalization.body);

    const recs = await request(server)
      .get(`${prefix}/profiles/${profileId}/recommendations`)
      .set('Cookie', viewer);
    expect(recs.status).toBe(200);
    const recIds = recs.body.items.map((item: { mediaId: string }) => item.mediaId);
    expect(recIds).toContain(idB);
    expect(recIds).not.toContain(idA);
    expect(recIds).not.toContain(idKids);

    const similar = await request(server)
      .get(`${prefix}/search/similar/movies/${idA}`)
      .set('Cookie', viewer);
    expect(similar.status).toBe(200);
    expect(similar.body.items.some((item: { id: string }) => item.id === idB)).toBe(true);

    const detail = await request(server).get(`${prefix}/movies/${idA}`).set('Cookie', viewer);
    expect(detail.status).toBe(200);
    expect(detail.body.movie.progressSeconds).toBe(400);
    expect(detail.body.movie.watched).toBe(false);

    const watched = await request(server).post(`${prefix}/movies/${idA}/watched`).set('Cookie', viewer);
    expect(watched.status).toBe(200);
    expect(watched.body.progress.completed).toBe(true);
    const afterWatch = await request(server).get(`${prefix}/movies/${idA}`).set('Cookie', viewer);
    expect(afterWatch.body.movie.watched).toBe(true);

    const home = await request(server).get(`${prefix}/home`).set('Cookie', viewer);
    expect(home.status).toBe(200);
    expect(home.body.favoriteIds).toContain(idA);
    const rowIds = home.body.rows.map((row: { id: string }) => row.id);
    expect(rowIds).toEqual(expect.arrayContaining(['recently-watched', 'recommended']));
    expect(rowIds).not.toContain('favorites');
    expect(rowIds).not.toContain('mylist');
    const recent = home.body.rows.find((row: { id: string }) => row.id === 'recently-watched');
    expect(recent.items.some((item: { id: string }) => item.id === idA)).toBe(true);
    assertNoPaths(home.body);

    const disliked = await request(server)
      .put(`${prefix}/profiles/${profileId}/reactions`)
      .set('Cookie', viewer)
      .send({ mediaId: idB, kind: 'movie', reaction: 'dislike' });
    expect(disliked.status).toBe(200);

    const recsAfter = await request(server)
      .get(`${prefix}/profiles/${profileId}/recommendations`)
      .set('Cookie', viewer);
    const recIdsAfter = recsAfter.body.items.map((item: { mediaId: string }) => item.mediaId);
    expect(recIdsAfter).not.toContain(idB);

    const similarAfter = await request(server)
      .get(`${prefix}/search/similar/movies/${idA}`)
      .set('Cookie', viewer);
    expect(similarAfter.body.items.some((item: { id: string }) => item.id === idB)).toBe(false);

    const historyList = await request(server)
      .get(`${prefix}/profiles/${profileId}/history`)
      .set('Cookie', viewer);
    expect(historyList.body.items.some((item: { mediaId: string; title: string }) => item.mediaId === idA && item.title === 'Ion Horizon')).toBe(true);

    const cleared = await request(server)
      .delete(`${prefix}/profiles/${profileId}/history`)
      .set('Cookie', viewer);
    expect(cleared.status).toBe(200);
    expect(cleared.body.deleted).toBeGreaterThan(0);
    const emptyHistory = await request(server)
      .get(`${prefix}/profiles/${profileId}/history`)
      .set('Cookie', viewer);
    expect(emptyHistory.body.items).toEqual([]);
    const continueWatching = await request(server)
      .get(`${prefix}/profiles/${profileId}/continue-watching`)
      .set('Cookie', viewer);
    expect(continueWatching.body.items).toEqual([]);

    const unwatched = await request(server).delete(`${prefix}/movies/${idA}/watched`).set('Cookie', viewer);
    expect(unwatched.status).toBe(200);
    expect(unwatched.body.progress.completed).toBe(false);

    const kids = await request(server)
      .post(`${prefix}/profiles`)
      .set('Cookie', viewer)
      .send({ name: 'Pers Kid', isKids: true });
    const kidsId = kids.body.profile.id as string;
    const kidsCookies = cookieJar(
      await request(server).post(`${prefix}/profiles/${kidsId}/select`).set('Cookie', viewer).send({}),
      viewer,
    );
    await request(server)
      .put(`${prefix}/profiles/${kidsId}/history`)
      .set('Cookie', kidsCookies)
      .send({ mediaId: idKids, progressSeconds: 20, durationSeconds: 4000 });
    const kidsRecs = await request(server)
      .get(`${prefix}/profiles/${kidsId}/recommendations`)
      .set('Cookie', kidsCookies);
    const kidsRecIds = kidsRecs.body.items.map((item: { mediaId: string }) => item.mediaId);
    expect(kidsRecIds).not.toContain(idA);
    expect(kidsRecIds).not.toContain(idB);
    const kidsFavorites = await request(server)
      .get(`${prefix}/profiles/${kidsId}/favorites`)
      .set('Cookie', kidsCookies);
    expect(kidsFavorites.body.items).toEqual([]);
    const kidsHome = await request(server).get(`${prefix}/home`).set('Cookie', kidsCookies);
    expect(JSON.stringify(kidsHome.body)).not.toContain('Ion Horizon');
    expect(JSON.stringify(kidsHome.body)).toContain('Harbor Pals');

    expect(
      (
        await request(server)
          .post(`${prefix}/profiles/${profileId}/favorites`)
          .set('Cookie', other)
          .send({ mediaId: idA, kind: 'movie' })
      ).status,
    ).toBe(404);
    expect(
      (await request(server).get(`${prefix}/profiles/${profileId}/personalization`).set('Cookie', other)).status,
    ).toBe(404);
    expect((await request(server).delete(`${prefix}/profiles/${profileId}/history`).set('Cookie', other)).status).toBe(
      404,
    );

    const draft = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Unreleased Cut',
        description: 'Must not enter personal libraries until published.',
        releaseYear: 2025,
        runtimeMinutes: 99,
        genres: ['drama'],
        maturityRating: 'mature',
        published: false,
      });
    expect(draft.status).toBe(201);
    const draftId = draft.body.movie.id as string;
    expect(
      (
        await request(server)
          .put(`${prefix}/profiles/${profileId}/history`)
          .set('Cookie', viewer)
          .send({ mediaId: draftId, progressSeconds: 12, durationSeconds: 5900 })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(server)
          .post(`${prefix}/profiles/${profileId}/favorites`)
          .set('Cookie', viewer)
          .send({ mediaId: draftId, kind: 'movie' })
      ).status,
    ).toBe(404);

    await request(server)
      .put(`${prefix}/profiles/${profileId}/history`)
      .set('Cookie', viewer)
      .send({ mediaId: idA, progressSeconds: 30, durationSeconds: 6600 });
    const hide = await request(server)
      .patch(`${prefix}/admin/movies/${idA}`)
      .set('Cookie', admin)
      .send({ published: false });
    expect(hide.status).toBe(200);
    const hiddenHistory = await request(server)
      .get(`${prefix}/profiles/${profileId}/history`)
      .set('Cookie', viewer);
    expect(hiddenHistory.body.items.some((item: { mediaId: string }) => item.mediaId === idA)).toBe(false);
  });
});
