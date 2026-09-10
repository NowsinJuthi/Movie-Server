import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Server } from 'http';
import { HomeRowKind, UserRole } from '@movie-server/shared';
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
  expect(raw).not.toContain(password);
  expect(raw).not.toMatch(/passwordHash|refreshToken|accessToken|tokenHash|storagePath/i);
  expect(raw).not.toMatch(/C:\\Users|\/var\/lib|storage\/uploads/i);
}

describe('Admin panel (e2e)', () => {
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
    expect(res.body.user).not.toHaveProperty('passwordHash');
    return cookieJar(res);
  }

  it('authorizes admin APIs server-side, audits mutations, and leaves empty CMS as a no-op on home', async () => {
    await users.createUser({
      email: 'panel-member@example.com',
      password,
      displayName: 'Panel Member',
      emailVerified: true,
      role: UserRole.User,
    });
    await users.createUser({
      email: 'panel-admin@example.com',
      password,
      displayName: 'Panel Admin',
      emailVerified: true,
      role: UserRole.Admin,
    });

    const memberLogin = await request(server)
      .post(`${prefix}/auth/login`)
      .send({ email: 'panel-member@example.com', password });
    expect(memberLogin.status).toBe(200);
    const member = cookieJar(memberLogin);
    const admin = await login('panel-admin@example.com');

    expect((await request(server).get(`${prefix}/admin/dashboard`)).status).toBe(401);
    expect((await request(server).get(`${prefix}/admin/dashboard`).set('Cookie', member)).status).toBe(403);
    expect((await request(server).post(`${prefix}/admin/home/rows`).set('Cookie', member).send({
      title: 'Hacked',
      kind: HomeRowKind.Featured,
    })).status).toBe(403);

    const dashboard = await request(server).get(`${prefix}/admin/dashboard`).set('Cookie', admin);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.users.total).toBeGreaterThanOrEqual(2);
    expect(dashboard.body.catalog).toEqual(
      expect.objectContaining({ movies: expect.any(Number), series: expect.any(Number) }),
    );
    assertNoSecrets(dashboard.body);

    const health = await request(server).get(`${prefix}/admin/health`).set('Cookie', admin);
    expect(health.status).toBe(200);
    expect(health.body.mongo).toBe('up');
    expect(health.body.redis).toBe('up');
    expect(health.body.queues.enabled).toBe(false);

    const jobs = await request(server).get(`${prefix}/admin/jobs`).set('Cookie', admin);
    expect(jobs.status).toBe(200);
    expect(Array.isArray(jobs.body.queues)).toBe(true);
    expect(Array.isArray(jobs.body.recent)).toBe(true);

    const userList = await request(server)
      .get(`${prefix}/admin/users`)
      .query({ q: 'panel-member', sort: 'newest' })
      .set('Cookie', admin);
    expect(userList.status).toBe(200);
    expect(Array.isArray(userList.body.users)).toBe(true);
    expect(Array.isArray(userList.body.items)).toBe(true);
    expect(userList.body.items.some((row: { email: string }) => row.email === 'panel-member@example.com')).toBe(true);
    assertNoSecrets(userList.body);

    await request(server).get(`${prefix}/profiles`).set('Cookie', member);
    const profiles = await request(server).get(`${prefix}/admin/profiles`).set('Cookie', admin);
    expect(profiles.status).toBe(200);
    expect(profiles.body.total).toBeGreaterThanOrEqual(1);

    const genres = await request(server).get(`${prefix}/admin/catalog/genres`).set('Cookie', admin);
    expect(genres.status).toBe(200);
    expect(genres.body.items.length).toBeGreaterThan(0);

    const tag = await request(server)
      .post(`${prefix}/admin/catalog/tags`)
      .set('Cookie', admin)
      .send({ name: 'Noir Cut' });
    expect(tag.status).toBe(201);
    expect(tag.body.item.slug).toBe('noir-cut');

    const hero = await request(server).get(`${prefix}/admin/home/hero`).set('Cookie', admin);
    expect(hero.status).toBe(200);
    expect(hero.body.hero.enabled).toBe(false);

    expect(
      (
        await request(server)
          .post(`${prefix}/subscriptions`)
          .set('Cookie', member)
          .send({ planSlug: 'basic', billingCycle: 'monthly' })
      ).status,
    ).toBe(201);
    const memberProfiles = await request(server).get(`${prefix}/profiles`).set('Cookie', member);
    const profileId = memberProfiles.body.profiles[0].id as string;
    const browsing = cookieJar(
      await request(server).post(`${prefix}/profiles/${profileId}/select`).set('Cookie', member).send({}),
      member,
    );

    const emptyCmsHome = await request(server).get(`${prefix}/home`).set('Cookie', browsing);
    expect(emptyCmsHome.status).toBe(200);
    expect((emptyCmsHome.body.rows as { id: string }[]).some((row) => row.id.startsWith('cms-'))).toBe(false);
    assertNoSecrets(emptyCmsHome.body);

    const row = await request(server)
      .post(`${prefix}/admin/home/rows`)
      .set('Cookie', admin)
      .send({ title: 'Staff picks', kind: HomeRowKind.Featured, enabled: true, sortOrder: 1 });
    expect(row.status).toBe(201);
    expect(row.body.row.title).toBe('Staff picks');

    const homeAfterCms = await request(server).get(`${prefix}/home`).set('Cookie', browsing);
    expect(homeAfterCms.status).toBe(200);
    assertNoSecrets(homeAfterCms.body);

    const plan = await request(server)
      .post(`${prefix}/admin/plans`)
      .set('Cookie', admin)
      .send({
        slug: 'admin-panel-test',
        name: 'Admin Panel Test',
        description: 'Created by the admin panel e2e suite.',
        tier: 'standard',
        monthlyPriceCents: 999,
        yearlyPriceCents: 9999,
        maxVideoQuality: 'hd',
        maxDevices: 2,
        maxStreams: 2,
        features: ['catalog', 'hd'],
      });
    expect(plan.status).toBe(201);

    const audit = await request(server).get(`${prefix}/admin/audit`).query({ q: 'home' }).set('Cookie', admin);
    expect(audit.status).toBe(200);
    expect(audit.body.items.length).toBeGreaterThan(0);
    expect(audit.body.items.some((item: { path: string; method: string }) => item.path.includes('/admin/home/rows') && item.method === 'POST')).toBe(true);
    assertNoSecrets(audit.body);

    const tracks = await request(server).get(`${prefix}/admin/tracks`).set('Cookie', admin);
    expect(tracks.status).toBe(200);
    expect(Array.isArray(tracks.body.items)).toBe(true);

    const invoices = await request(server).get(`${prefix}/admin/billing/invoices`).set('Cookie', admin);
    expect(invoices.status).toBe(200);
    expect(Array.isArray(invoices.body.invoices)).toBe(true);

    const subscriptions = await request(server).get(`${prefix}/admin/subscriptions`).set('Cookie', admin);
    expect(subscriptions.status).toBe(200);
    expect(Array.isArray(subscriptions.body.subscriptions)).toBe(true);
  });
});
