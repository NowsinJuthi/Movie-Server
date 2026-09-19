import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Server } from 'http';
import { ErrorCode, UserRole } from '@movie-server/shared';
import { UsersService } from '../src/users/users.service';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';

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

describe('Subscriptions (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let mongod: MongoMemoryServer;
  let users: UsersService;
  let subscriptions: SubscriptionsService;

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
    subscriptions = app.get(SubscriptionsService);
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

  it('lists public Basic, Standard, and Premium plans without auth', async () => {
    const res = await request(server).get(`${prefix}/plans`);
    expect(res.status).toBe(200);
    const slugs = res.body.plans.map((plan: { slug: string }) => plan.slug);
    expect(slugs).toEqual(expect.arrayContaining(['basic', 'standard', 'premium']));
    expect(res.body.plans[0].monthlyPriceCents).toEqual(expect.any(Number));
    expect(res.body.plans[0].currency).toBe('BDT');
  });

  it('rejects premium content and UHD playback without a server-verified subscription', async () => {
    await seedUser('nosub@example.com');
    const cookies = await login('nosub@example.com');

    const premium = await request(server).get(`${prefix}/content/premium`).set('Cookie', cookies);
    expect(premium.status).toBe(403);
    expect(premium.body.error).toBe(ErrorCode.SubscriptionRequired);

    const playback = await request(server)
      .post(`${prefix}/content/playback-auth`)
      .set('Cookie', cookies)
      .send({ quality: 'sd' });
    expect(playback.status).toBe(403);
    expect(playback.body.error).toBe(ErrorCode.SubscriptionRequired);
  });

  it('starts a Basic trial, enforces quality/stream limits, then upgrades to Premium', async () => {
    await seedUser('trial@example.com');
    const cookies = await login('trial@example.com');

    const started = await request(server)
      .post(`${prefix}/subscriptions`)
      .set('Cookie', cookies)
      .send({ planSlug: 'basic', billingCycle: 'monthly' });
    expect(started.status).toBe(201);
    expect(started.body.subscription.status).toBe('trial');
    expect(started.body.subscription.entitled).toBe(true);
    expect(started.body.paymentRequired).toBe(false);
    expect(started.body.entitlement.entitled).toBe(true);

    const sd = await request(server)
      .post(`${prefix}/content/playback-auth`)
      .set('Cookie', cookies)
      .send({ quality: 'sd', currentStreamCount: 0 });
    expect(sd.status).toBe(200);
    expect(sd.body.allowed).toBe(true);

    const uhd = await request(server)
      .post(`${prefix}/content/playback-auth`)
      .set('Cookie', cookies)
      .send({ quality: 'uhd' });
    expect(uhd.status).toBe(403);
    expect(uhd.body.error).toBe(ErrorCode.QualityNotAllowed);

    const streams = await request(server)
      .post(`${prefix}/content/playback-auth`)
      .set('Cookie', cookies)
      .send({ quality: 'sd', currentStreamCount: 1 });
    expect(streams.status).toBe(200);
    expect(streams.body.allowed).toBe(true);

    const feature = await request(server).get(`${prefix}/content/uhd-preview`).set('Cookie', cookies);
    expect(feature.status).toBe(403);
    expect(feature.body.error).toBe(ErrorCode.FeatureNotAllowed);

    const upgraded = await request(server)
      .post(`${prefix}/subscriptions/me/change`)
      .set('Cookie', cookies)
      .send({ planSlug: 'premium', billingCycle: 'yearly' });
    expect(upgraded.status).toBe(200);
    expect(upgraded.body.subscription.plan.slug).toBe('premium');
    expect(upgraded.body.subscription.billingCycle).toBe('yearly');

    const uhdOk = await request(server).get(`${prefix}/content/uhd-preview`).set('Cookie', cookies);
    expect(uhdOk.status).toBe(200);
    expect(uhdOk.body.entitlement.maxVideoQuality).toBe('uhd');
  });

  it('schedules a downgrade, cancels with continued access, resumes, then expires', async () => {
    await seedUser('cycle@example.com');
    const cookies = await login('cycle@example.com');
    await seedUser('cycle-admin@example.com', UserRole.Admin);
    const adminCookies = await login('cycle-admin@example.com');

    await request(server)
      .post(`${prefix}/subscriptions`)
      .set('Cookie', cookies)
      .send({ planSlug: 'premium', billingCycle: 'monthly' });

    const downgraded = await request(server)
      .post(`${prefix}/subscriptions/me/change`)
      .set('Cookie', cookies)
      .send({ planSlug: 'basic', billingCycle: 'monthly' });
    expect(downgraded.status).toBe(200);
    expect(downgraded.body.subscription.plan.slug).toBe('premium');
    expect(downgraded.body.subscription.scheduledPlanId).toBeTruthy();

    const stillUhd = await request(server).get(`${prefix}/content/uhd-preview`).set('Cookie', cookies);
    expect(stillUhd.status).toBe(200);

    await request(server)
      .patch(`${prefix}/admin/subscriptions/${downgraded.body.subscription.id}`)
      .set('Cookie', adminCookies)
      .send({ scheduledChangeAt: new Date(Date.now() - 1000).toISOString() });

    const afterSchedule = await request(server).get(`${prefix}/subscriptions/me`).set('Cookie', cookies);
    expect(afterSchedule.body.subscription.plan.slug).toBe('basic');
    expect(afterSchedule.body.subscription.scheduledPlanId).toBeNull();

    const uhdDenied = await request(server).get(`${prefix}/content/uhd-preview`).set('Cookie', cookies);
    expect(uhdDenied.status).toBe(403);

    const cancelled = await request(server)
      .post(`${prefix}/subscriptions/me/cancel`)
      .set('Cookie', cookies);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.subscription.status).toBe('cancelled');
    expect(cancelled.body.entitlement.entitled).toBe(true);

    const resumed = await request(server)
      .post(`${prefix}/subscriptions/me/resume`)
      .set('Cookie', cookies);
    expect(resumed.status).toBe(200);
    expect(['active', 'trial']).toContain(resumed.body.subscription.status);

    await request(server).post(`${prefix}/subscriptions/me/cancel`).set('Cookie', cookies);
    await request(server)
      .patch(`${prefix}/admin/subscriptions/${resumed.body.subscription.id}`)
      .set('Cookie', adminCookies)
      .send({
        autoRenew: false,
        currentPeriodEnd: new Date(Date.now() - 1000).toISOString(),
      });

    const expired = await request(server).get(`${prefix}/subscriptions/me`).set('Cookie', cookies);
    expect(expired.body.subscription.status).toBe('expired');
    expect(expired.body.entitlement.entitled).toBe(false);

    const premium = await request(server).get(`${prefix}/content/premium`).set('Cookie', cookies);
    expect(premium.status).toBe(403);
    expect(premium.body.error).toBe(ErrorCode.SubscriptionInactive);

    const history = await request(server)
      .get(`${prefix}/subscriptions/me/history`)
      .set('Cookie', cookies);
    expect(history.body.events.length).toBeGreaterThan(0);
    const changes = await request(server)
      .get(`${prefix}/subscriptions/me/changes`)
      .set('Cookie', cookies);
    expect(changes.body.events.some((event: { type: string }) => event.type === 'downgraded')).toBe(
      true,
    );
  });

  it('renews an active period and applies grace after suspension', async () => {
    await seedUser('renew@example.com');
    const cookies = await login('renew@example.com');
    await seedUser('renew-admin@example.com', UserRole.Admin);
    const adminCookies = await login('renew-admin@example.com');

    const started = await request(server)
      .post(`${prefix}/subscriptions`)
      .set('Cookie', cookies)
      .send({ planSlug: 'standard', billingCycle: 'monthly' });
    const id = started.body.subscription.id as string;

    await request(server)
      .patch(`${prefix}/admin/subscriptions/${id}`)
      .set('Cookie', adminCookies)
      .send({
        status: 'active',
        autoRenew: true,
        currentPeriodEnd: new Date(Date.now() - 1000).toISOString(),
      });

    const renewed = await request(server).get(`${prefix}/subscriptions/me`).set('Cookie', cookies);
    expect(renewed.body.subscription.status).toBe('active');
    expect(new Date(renewed.body.subscription.currentPeriodEnd).getTime()).toBeGreaterThan(Date.now());

    const suspended = await request(server)
      .post(`${prefix}/admin/subscriptions/${id}/suspend`)
      .set('Cookie', adminCookies)
      .send({ reason: 'card_declined' });
    expect(suspended.body.subscription.status).toBe('suspended');
    expect(suspended.body.subscription.entitled).toBe(true);

    const duringGrace = await request(server).get(`${prefix}/content/premium`).set('Cookie', cookies);
    expect(duringGrace.status).toBe(200);

    await request(server)
      .patch(`${prefix}/admin/subscriptions/${id}`)
      .set('Cookie', adminCookies)
      .send({ gracePeriodEndsAt: new Date(Date.now() - 1000).toISOString() });

    const afterGrace = await request(server).get(`${prefix}/subscriptions/me`).set('Cookie', cookies);
    expect(afterGrace.body.subscription.status).toBe('expired');
    expect(afterGrace.body.entitlement.entitled).toBe(false);
  });

  it('keeps Pending subscriptions locked until activateFromPayment (Task 4 hook)', async () => {
    const user = await seedUser('pending@example.com');
    await seedUser('pending-admin@example.com', UserRole.Admin);
    const adminCookies = await login('pending-admin@example.com');
    const cookies = await login('pending@example.com');

    const granted = await request(server)
      .post(`${prefix}/admin/subscriptions`)
      .set('Cookie', adminCookies)
      .send({
        userId: String(user._id),
        planSlug: 'standard',
        billingCycle: 'monthly',
        status: 'pending',
      });
    expect(granted.status).toBe(201);
    expect(granted.body.subscription.status).toBe('pending');
    expect(granted.body.subscription.entitled).toBe(false);

    const locked = await request(server).get(`${prefix}/content/premium`).set('Cookie', cookies);
    expect(locked.status).toBe(403);

    const activated = await request(server)
      .post(`${prefix}/admin/subscriptions/${granted.body.subscription.id}/activate`)
      .set('Cookie', adminCookies)
      .send({ provider: 'stripe', externalRef: 'pi_test_123' });
    expect(activated.body.subscription.status).toBe('active');
    expect(activated.body.subscription.entitled).toBe(true);
    expect(activated.body.subscription.paymentProvider).toBe('stripe');

    const open = await request(server).get(`${prefix}/content/premium`).set('Cookie', cookies);
    expect(open.status).toBe(200);
  });

  it('starts a paid subscription after trial was already used', async () => {
    await seedUser('second@example.com');
    const cookies = await login('second@example.com');
    await seedUser('second-admin@example.com', UserRole.Admin);
    const adminCookies = await login('second-admin@example.com');

    const first = await request(server)
      .post(`${prefix}/subscriptions`)
      .set('Cookie', cookies)
      .send({ planSlug: 'basic', billingCycle: 'monthly' });
    expect(first.body.subscription.status).toBe('trial');

    await request(server).post(`${prefix}/subscriptions/me/cancel`).set('Cookie', cookies);
    await request(server)
      .patch(`${prefix}/admin/subscriptions/${first.body.subscription.id}`)
      .set('Cookie', adminCookies)
      .send({
        autoRenew: false,
        currentPeriodEnd: new Date(Date.now() - 1000).toISOString(),
      });
    await request(server).get(`${prefix}/subscriptions/me`).set('Cookie', cookies);

    const second = await request(server)
      .post(`${prefix}/subscriptions`)
      .set('Cookie', cookies)
      .send({ planSlug: 'standard', billingCycle: 'yearly' });
    expect(second.status).toBe(201);
    expect(second.body.subscription.status).toBe('active');
    expect(second.body.subscription.trialStart).toBeNull();
  });

  it('lets admins manage plans and blocks regular users', async () => {
    await seedUser('plans-user@example.com');
    const userCookies = await login('plans-user@example.com');
    await seedUser('plans-admin@example.com', UserRole.Admin);
    const adminCookies = await login('plans-admin@example.com');

    const forbidden = await request(server).get(`${prefix}/admin/plans`).set('Cookie', userCookies);
    expect(forbidden.status).toBe(403);

    const created = await request(server)
      .post(`${prefix}/admin/plans`)
      .set('Cookie', adminCookies)
      .send({
        slug: 'family',
        name: 'Family',
        description: 'Extra screens for a household.',
        tier: 'premium',
        monthlyPriceCents: 2999,
        yearlyPriceCents: 29999,
        maxVideoQuality: 'uhd',
        maxDevices: 6,
        maxStreams: 6,
        features: ['catalog', 'hd', 'uhd', 'downloads'],
        trialDays: 0,
      });
    expect(created.status).toBe(201);
    expect(created.body.plan.slug).toBe('family');
    expect(created.body.plan.rank).toBe(3);

    const patched = await request(server)
      .patch(`${prefix}/admin/plans/${created.body.plan.id}`)
      .set('Cookie', adminCookies)
      .send({ monthlyPriceCents: 2499, isActive: true });
    expect(patched.body.plan.monthlyPriceCents).toBe(2499);

    const disabled = await request(server)
      .delete(`${prefix}/admin/plans/${created.body.plan.id}`)
      .set('Cookie', adminCookies);
    expect(disabled.body.plan.isActive).toBe(false);

    const publicPlans = await request(server).get(`${prefix}/plans`);
    expect(publicPlans.body.plans.some((plan: { slug: string }) => plan.slug === 'family')).toBe(
      false,
    );
  });

  it('lets admin delete a subscription and clears subscriber access', async () => {
    const user = await seedUser('delete-sub@example.com');
    await seedUser('delete-sub-admin@example.com', UserRole.Admin);
    const adminCookies = await login('delete-sub-admin@example.com');
    const cookies = await login('delete-sub@example.com');

    const granted = await request(server)
      .post(`${prefix}/admin/subscriptions`)
      .set('Cookie', adminCookies)
      .send({
        userId: String(user._id),
        planSlug: 'standard',
        billingCycle: 'monthly',
        status: 'active',
      });
    expect(granted.status).toBe(201);
    const subId = granted.body.subscription.id as string;

    const before = await request(server).get(`${prefix}/subscriptions/me`).set('Cookie', cookies);
    expect(before.body.subscription).toBeTruthy();
    expect(before.body.entitlement.entitled).toBe(true);

    const deleted = await request(server)
      .delete(`${prefix}/admin/subscriptions/${subId}`)
      .set('Cookie', adminCookies);
    expect(deleted.status).toBe(200);
    expect(deleted.body.id).toBe(subId);

    const after = await request(server).get(`${prefix}/subscriptions/me`).set('Cookie', cookies);
    expect(after.body.subscription).toBeNull();
    expect(after.body.entitlement.entitled).toBe(false);

    const listed = await request(server).get(`${prefix}/admin/subscriptions`).set('Cookie', adminCookies);
    expect(listed.body.subscriptions.some((row: { id: string }) => row.id === subId)).toBe(false);
  });

  it('does not trust a second account to mutate another user subscription', async () => {
    await seedUser('owner-sub@example.com');
    await seedUser('intruder-sub@example.com');
    const ownerCookies = await login('owner-sub@example.com');
    const otherCookies = await login('intruder-sub@example.com');

    await request(server)
      .post(`${prefix}/subscriptions`)
      .set('Cookie', ownerCookies)
      .send({ planSlug: 'basic', billingCycle: 'monthly' });

    const otherMe = await request(server).get(`${prefix}/subscriptions/me`).set('Cookie', otherCookies);
    expect(otherMe.body.subscription).toBeNull();
    expect(otherMe.body.entitlement.entitled).toBe(false);

    const cancel = await request(server)
      .post(`${prefix}/subscriptions/me/cancel`)
      .set('Cookie', otherCookies);
    expect(cancel.status).toBe(404);
  });

  it('exposes activateFromPayment and recordFailedRenewal for Task 4 without rewriting architecture', async () => {
    const user = await seedUser('hooks@example.com');
    const granted = await subscriptions.grantComplimentary({
      userId: String(user._id),
      planSlug: 'premium',
      billingCycle: 'monthly',
      status: 'pending',
    });
    expect(granted.status).toBe('pending');

    const paid = await subscriptions.activateFromPayment(String(granted._id), {
      provider: 'stripe',
      externalRef: 'pi_hook_1',
      paidCents: 2299,
    });
    expect(paid.status).toBe('active');

    const failed = await subscriptions.recordFailedRenewal(String(paid._id), 'webhook_nacked');
    expect(failed.status).toBe('suspended');
    expect(failed.gracePeriodEndsAt).toBeTruthy();
  });
});
