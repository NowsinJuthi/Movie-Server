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
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

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

describe('Profiles (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let mongod: MongoMemoryServer;
  let users: UsersService;

  beforeAll(async () => {
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

  it('creates, edits, lists, and deletes profiles under one account', async () => {
    await seedUser('owner@example.com');
    const cookies = await login('owner@example.com');

    const listed = await request(server).get(`${prefix}/profiles`).set('Cookie', cookies);
    expect(listed.status).toBe(200);
    expect(listed.body.profiles).toHaveLength(1);
    expect(listed.body.profiles[0].hasPin).toBe(false);
    expect(JSON.stringify(listed.body)).not.toContain('pinHash');

    const created = await request(server)
      .post(`${prefix}/profiles`)
      .set('Cookie', cookies)
      .send({
        name: 'Kids',
        isKids: true,
        language: 'es',
        audioLanguage: 'es',
        subtitleLanguage: 'en',
        maturityLevel: 'mature',
      });
    expect(created.status).toBe(201);
    expect(created.body.profile.isKids).toBe(true);
    expect(created.body.profile.maturityLevel).toBe('kids');
    expect(created.body.profile.language).toBe('es');

    const id = created.body.profile.id as string;
    const patched = await request(server)
      .patch(`${prefix}/profiles/${id}`)
      .set('Cookie', cookies)
      .send({ name: 'Little One', subtitleLanguage: 'off' });
    expect(patched.status).toBe(200);
    expect(patched.body.profile.name).toBe('Little One');

    const deleted = await request(server)
      .delete(`${prefix}/profiles/${id}`)
      .set('Cookie', cookies);
    expect(deleted.status).toBe(200);

    const last = listed.body.profiles[0].id as string;
    const cannotDropLast = await request(server)
      .delete(`${prefix}/profiles/${last}`)
      .set('Cookie', cookies);
    expect(cannotDropLast.status).toBe(403);
  });

  it('enforces the profile cap and PIN-protected switching', async () => {
    await seedUser('pins@example.com');
    const cookies = await login('pins@example.com');
    await request(server).get(`${prefix}/profiles`).set('Cookie', cookies);

    for (let i = 0; i < 4; i += 1) {
      const res = await request(server)
        .post(`${prefix}/profiles`)
        .set('Cookie', cookies)
        .send({ name: `P${i}` });
      expect(res.status).toBe(201);
    }
    const overflow = await request(server)
      .post(`${prefix}/profiles`)
      .set('Cookie', cookies)
      .send({ name: 'Too Many' });
    expect(overflow.status).toBe(403);
    expect(overflow.body.error).toBe(ErrorCode.ProfileLimitReached);

    const locked = await request(server)
      .post(`${prefix}/profiles`)
      .set('Cookie', cookies)
      .send({ name: 'Locked', pin: '2468' });
    expect(locked.status).toBe(403);

    const names = await request(server).get(`${prefix}/profiles`).set('Cookie', cookies);
    const first = names.body.profiles[0];
    await request(server)
      .delete(`${prefix}/profiles/${names.body.profiles[4].id}`)
      .set('Cookie', cookies);

    const withPin = await request(server)
      .post(`${prefix}/profiles`)
      .set('Cookie', cookies)
      .send({ name: 'Vault', pin: '2468' });
    expect(withPin.status).toBe(201);
    expect(withPin.body.profile.hasPin).toBe(true);
    const pinId = withPin.body.profile.id as string;

    const needsPin = await request(server)
      .post(`${prefix}/profiles/${pinId}/select`)
      .set('Cookie', cookies)
      .send({});
    expect(needsPin.status).toBe(403);
    expect(needsPin.body.error).toBe(ErrorCode.ProfilePinRequired);

    const wrong = await request(server)
      .post(`${prefix}/profiles/${pinId}/select`)
      .set('Cookie', cookies)
      .send({ pin: '0000' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toBe(ErrorCode.ProfilePinInvalid);

    const unlocked = await request(server)
      .post(`${prefix}/profiles/${pinId}/select`)
      .set('Cookie', cookies)
      .send({ pin: '2468' });
    expect(unlocked.status).toBe(200);

    const active = await request(server).get(`${prefix}/profiles/active`).set('Cookie', cookies);
    expect(active.body.profile.id).toBe(pinId);

    const switched = await request(server)
      .post(`${prefix}/profiles/${first.id}/select`)
      .set('Cookie', cookies)
      .send({});
    expect(switched.status).toBe(200);
    const after = await request(server).get(`${prefix}/profiles/active`).set('Cookie', cookies);
    expect(after.body.profile.id).toBe(first.id);
  });

  it('keeps watch history, My List, and recommendations isolated per profile and account', async () => {
    await seedUser('alice@example.com');
    await seedUser('bob@example.com');
    await seedUser('profiles-admin@example.com', UserRole.Admin);
    const alice = await login('alice@example.com');
    const bob = await login('bob@example.com');
    const admin = await login('profiles-admin@example.com');

    const adult = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Adult Isolation',
        description: 'Used as adult-profile watch history.',
        releaseYear: 2021,
        runtimeMinutes: 110,
        genres: ['drama'],
        maturityRating: 'mature',
        published: true,
      });
    const favorite = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Adult Favorite',
        description: 'Used as adult-profile My List item.',
        releaseYear: 2022,
        runtimeMinutes: 100,
        genres: ['thriller'],
        maturityRating: 'mature',
        published: true,
      });
    const kidsTitle = await request(server)
      .post(`${prefix}/admin/movies`)
      .set('Cookie', admin)
      .send({
        title: 'Kids Isolation',
        description: 'Used as kids-profile watch history.',
        releaseYear: 2024,
        runtimeMinutes: 72,
        genres: ['family'],
        maturityRating: 'kids',
        published: true,
      });
    expect(adult.status).toBe(201);
    expect(favorite.status).toBe(201);
    expect(kidsTitle.status).toBe(201);
    const showAdult = adult.body.movie.id as string;
    const favAdult = favorite.body.movie.id as string;
    const showKids = kidsTitle.body.movie.id as string;

    const aliceProfiles = await request(server).get(`${prefix}/profiles`).set('Cookie', alice);
    const bobProfiles = await request(server).get(`${prefix}/profiles`).set('Cookie', bob);
    const aliceMain = aliceProfiles.body.profiles[0].id as string;
    const bobMain = bobProfiles.body.profiles[0].id as string;

    const kids = await request(server)
      .post(`${prefix}/profiles`)
      .set('Cookie', alice)
      .send({ name: 'Alice Kids', isKids: true });
    const aliceKids = kids.body.profile.id as string;

    await request(server)
      .put(`${prefix}/profiles/${aliceMain}/history`)
      .set('Cookie', alice)
      .send({ mediaId: showAdult, progressSeconds: 120, durationSeconds: 2400 });
    await request(server)
      .put(`${prefix}/profiles/${aliceKids}/history`)
      .set('Cookie', alice)
      .send({ mediaId: showKids, progressSeconds: 30, durationSeconds: 600 });
    await request(server)
      .post(`${prefix}/profiles/${aliceMain}/list`)
      .set('Cookie', alice)
      .send({ mediaId: favAdult });

    const continueMain = await request(server)
      .get(`${prefix}/profiles/${aliceMain}/continue-watching`)
      .set('Cookie', alice);
    expect(continueMain.body.items.map((item: { mediaId: string }) => item.mediaId)).toEqual([
      showAdult,
    ]);

    const continueKids = await request(server)
      .get(`${prefix}/profiles/${aliceKids}/continue-watching`)
      .set('Cookie', alice);
    expect(continueKids.body.items.map((item: { mediaId: string }) => item.mediaId)).toEqual([
      showKids,
    ]);

    const recs = await request(server)
      .get(`${prefix}/profiles/${aliceMain}/recommendations`)
      .set('Cookie', alice);
    const recIds = recs.body.items.map((item: { mediaId: string }) => item.mediaId);
    expect(recIds).not.toContain(showKids);

    const stolenGet = await request(server)
      .get(`${prefix}/profiles/${aliceMain}`)
      .set('Cookie', bob);
    expect(stolenGet.status).toBe(404);

    const stolenHistory = await request(server)
      .put(`${prefix}/profiles/${aliceMain}/history`)
      .set('Cookie', bob)
      .send({ mediaId: 'hack', progressSeconds: 1, durationSeconds: 10 });
    expect(stolenHistory.status).toBe(404);

    const stolenList = await request(server)
      .post(`${prefix}/profiles/${aliceMain}/list`)
      .set('Cookie', bob)
      .send({ mediaId: 'hack' });
    expect(stolenList.status).toBe(404);

    const bobHistory = await request(server)
      .get(`${prefix}/profiles/${bobMain}/history`)
      .set('Cookie', bob);
    expect(bobHistory.body.items).toEqual([]);
  });

  it('uploads, replaces, and deletes a profile avatar', async () => {
    await seedUser('avatar@example.com');
    const cookies = await login('avatar@example.com');
    const listed = await request(server).get(`${prefix}/profiles`).set('Cookie', cookies);
    const id = listed.body.profiles[0].id as string;

    const uploaded = await request(server)
      .post(`${prefix}/profiles/${id}/avatar`)
      .set('Cookie', cookies)
      .attach('file', tinyPng, { filename: 'dot.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.profile.avatarUrl).toMatch(/\/uploads\/avatars\//);
    expect(JSON.stringify(uploaded.body)).not.toContain('pinHash');

    const image = await request(server).get(uploaded.body.profile.avatarUrl);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toMatch(/image/);

    const cleared = await request(server)
      .delete(`${prefix}/profiles/${id}/avatar`)
      .set('Cookie', cookies);
    expect(cleared.status).toBe(200);
    expect(cleared.body.profile.avatarUrl).toBeNull();
  });
});
