import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Server } from 'http';
import { ErrorCode, UserRole } from '@movie-server/shared';
import { UsersService } from '../src/users/users.service';
import { BillingService } from '../src/billing/billing.service';
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

describe('Billing (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let mongod: MongoMemoryReplSet;
  let users: UsersService;
  let billing: BillingService;
  let subscriptions: SubscriptionsService;

  beforeAll(async () => {
    process.env.SUBSCRIPTION_REQUIRE_PAYMENT = 'true';
    process.env.PAYMENT_PROVIDER = 'fake';
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongod.getUri();
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
    users = app.get(UsersService);
    billing = app.get(BillingService);
    subscriptions = app.get(SubscriptionsService);
  }, 180000);

  afterAll(async () => {
    process.env.SUBSCRIPTION_REQUIRE_PAYMENT = 'false';
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

  async function postWebhook(body: Record<string, unknown>) {
    const payload = JSON.stringify(body);
    const signature = await billing.webhookSignForTests(Buffer.from(payload));
    return request(server)
      .post(`${prefix}/billing/webhooks/fake`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', signature)
      .send(payload);
  }

  it('does not activate a pending subscription until a signed webhook is verified', async () => {
    const user = await seedUser('pay@example.com');
    await seedUser('pay-admin@example.com', UserRole.Admin);
    const adminCookies = await login('pay-admin@example.com');
    const cookies = await login('pay@example.com');

    const granted = await request(server)
      .post(`${prefix}/admin/subscriptions`)
      .set('Cookie', adminCookies)
      .send({
        userId: String(user._id),
        planSlug: 'standard',
        billingCycle: 'monthly',
        status: 'pending',
      });
    expect(granted.body.subscription.status).toBe('pending');

    const locked = await request(server).get(`${prefix}/content/premium`).set('Cookie', cookies);
    expect(locked.status).toBe(403);

    const checkout = await request(server)
      .post(`${prefix}/billing/checkout`)
      .set('Cookie', cookies)
      .set('Idempotency-Key', 'pay-standard-1')
      .send({ subscriptionId: granted.body.subscription.id });
    expect(checkout.status).toBe(201);
    expect(checkout.body.checkoutUrl).toContain('session_id=');
    expect(checkout.body.amountCents).toBe(1599);
    expect(checkout.body.provider).toBe('fake');

    const reused = await request(server)
      .post(`${prefix}/billing/checkout`)
      .set('Cookie', cookies)
      .set('Idempotency-Key', 'pay-standard-1')
      .send({ subscriptionId: granted.body.subscription.id });
    expect(reused.body.sessionId).toBe(checkout.body.sessionId);

    const stillLocked = await request(server).get(`${prefix}/content/premium`).set('Cookie', cookies);
    expect(stillLocked.status).toBe(403);

    const invalid = await request(server)
      .post(`${prefix}/billing/webhooks/fake`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', 'deadbeef')
      .send(JSON.stringify({ id: 'evt_bad' }));
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe(ErrorCode.WebhookInvalid);

    const webhook = await postWebhook({
      id: 'evt_paid_1',
      type: 'checkout.session.completed',
      data: {
        sessionId: checkout.body.sessionId,
        paymentIntentId: `fake_pi_${checkout.body.paymentId}`,
        amountCents: 1599,
        currency: 'usd',
        metadata: { paymentId: checkout.body.paymentId, userId: String(user._id) },
      },
    });
    expect(webhook.status).toBe(200);
    expect(webhook.body.processed).toBe(true);

    const replay = await postWebhook({
      id: 'evt_paid_1',
      type: 'checkout.session.completed',
      data: {
        sessionId: checkout.body.sessionId,
        paymentIntentId: `fake_pi_${checkout.body.paymentId}`,
        amountCents: 1599,
        currency: 'usd',
        metadata: { paymentId: checkout.body.paymentId, userId: String(user._id) },
      },
    });
    expect(replay.body.duplicate).toBe(true);

    const me = await request(server).get(`${prefix}/subscriptions/me`).set('Cookie', cookies);
    expect(me.body.subscription.status).toBe('active');
    expect(me.body.entitlement.entitled).toBe(true);

    const premium = await request(server).get(`${prefix}/content/premium`).set('Cookie', cookies);
    expect(premium.status).toBe(200);

    const history = await request(server).get(`${prefix}/billing/history`).set('Cookie', cookies);
    expect(history.body.payments[0].status).toBe('success');
    expect(history.body.invoices[0].status).toBe('paid');
    expect(history.body.payments[0].cardLast4).toBe('4242');

    await seedUser('invoice-thief@example.com');
    const thief = await login('invoice-thief@example.com');
    const stolenInvoice = await request(server)
      .get(`${prefix}/billing/invoices/${history.body.invoices[0].id}`)
      .set('Cookie', thief);
    expect(stolenInvoice.status).toBe(404);
  });

  it('rejects another user verifying or paying someone else\'s checkout', async () => {
    const owner = await seedUser('owner-bill@example.com');
    await seedUser('intruder-bill@example.com');
    await seedUser('owner-admin@example.com', UserRole.Admin);
    const adminCookies = await login('owner-admin@example.com');
    const ownerCookies = await login('owner-bill@example.com');
    const otherCookies = await login('intruder-bill@example.com');

    const granted = await request(server)
      .post(`${prefix}/admin/subscriptions`)
      .set('Cookie', adminCookies)
      .send({
        userId: String(owner._id),
        planSlug: 'basic',
        billingCycle: 'monthly',
        status: 'pending',
      });
    const checkout = await request(server)
      .post(`${prefix}/billing/checkout`)
      .set('Cookie', ownerCookies)
      .send({ subscriptionId: granted.body.subscription.id });

    const stolen = await request(server)
      .post(`${prefix}/billing/checkout/verify`)
      .set('Cookie', otherCookies)
      .send({ sessionId: checkout.body.sessionId });
    expect(stolen.status).toBe(404);

    const history = await request(server).get(`${prefix}/billing/history`).set('Cookie', otherCookies);
    expect(history.body.payments).toHaveLength(0);
  });

  it('does not activate a subscription when the paid amount does not match the invoice', async () => {
    const user = await seedUser('amount-mismatch@example.com');
    await seedUser('amount-mismatch-admin@example.com', UserRole.Admin);
    const adminCookies = await login('amount-mismatch-admin@example.com');
    const cookies = await login('amount-mismatch@example.com');
    const granted = await request(server)
      .post(`${prefix}/admin/subscriptions`)
      .set('Cookie', adminCookies)
      .send({
        userId: String(user._id),
        planSlug: 'basic',
        billingCycle: 'monthly',
        status: 'pending',
      });
    const checkout = await request(server)
      .post(`${prefix}/billing/checkout`)
      .set('Cookie', cookies)
      .send({ subscriptionId: granted.body.subscription.id });

    const mismatch = await postWebhook({
      id: 'evt_amount_mismatch_1',
      type: 'checkout.session.completed',
      data: {
        sessionId: 'fake_cs_unknown_session',
        paymentIntentId: `fake_pi_${checkout.body.paymentId}`,
        amountCents: 1,
        currency: 'usd',
        metadata: { paymentId: checkout.body.paymentId, userId: String(user._id) },
      },
    });
    expect(mismatch.status).toBeGreaterThanOrEqual(400);

    const me = await request(server).get(`${prefix}/subscriptions/me`).set('Cookie', cookies);
    expect(me.body.subscription.status).toBe('pending');
    expect(me.body.entitlement.entitled).toBe(false);
  });

  it('records failed and cancelled payments without activating access', async () => {
    const user = await seedUser('fail@example.com');
    await seedUser('fail-admin@example.com', UserRole.Admin);
    const adminCookies = await login('fail-admin@example.com');
    const cookies = await login('fail@example.com');
    const granted = await request(server)
      .post(`${prefix}/admin/subscriptions`)
      .set('Cookie', adminCookies)
      .send({
        userId: String(user._id),
        planSlug: 'premium',
        billingCycle: 'yearly',
        status: 'pending',
      });
    const checkout = await request(server)
      .post(`${prefix}/billing/checkout`)
      .set('Cookie', cookies)
      .send({ subscriptionId: granted.body.subscription.id });

    const failed = await postWebhook({
      id: 'evt_fail_1',
      type: 'payment_intent.payment_failed',
      data: { sessionId: checkout.body.sessionId, metadata: { paymentId: checkout.body.paymentId } },
    });
    expect(failed.status).toBe(200);

    const history = await request(server).get(`${prefix}/billing/history`).set('Cookie', cookies);
    expect(history.body.payments[0].status).toBe('failed');
    const me = await request(server).get(`${prefix}/subscriptions/me`).set('Cookie', cookies);
    expect(me.body.subscription.status).toBe('pending');
    expect(me.body.entitlement.entitled).toBe(false);
  });

  it('renews a suspended subscription after a verified renewal payment', async () => {
    const user = await seedUser('renew-bill@example.com');
    const cookies = await login('renew-bill@example.com');
    const granted = await subscriptions.grantComplimentary({
      userId: String(user._id),
      planSlug: 'standard',
      billingCycle: 'monthly',
      status: 'active',
    });
    await subscriptions.recordFailedRenewal(String(granted._id), 'card_declined');

    const checkout = await request(server)
      .post(`${prefix}/billing/checkout`)
      .set('Cookie', cookies)
      .send({ kind: 'renewal' });
    expect(checkout.status).toBe(201);

    const paid = await postWebhook({
      id: 'evt_renew_1',
      type: 'checkout.session.completed',
      data: {
        sessionId: checkout.body.sessionId,
        paymentIntentId: `fake_pi_${checkout.body.paymentId}`,
        amountCents: checkout.body.amountCents,
        currency: 'usd',
        metadata: { paymentId: checkout.body.paymentId },
      },
    });
    expect(paid.status).toBe(200);

    const me = await request(server).get(`${prefix}/subscriptions/me`).set('Cookie', cookies);
    expect(me.body.subscription.status).toBe('active');
    expect(me.body.entitlement.entitled).toBe(true);
  });

  it('lets admins refund a captured payment without storing card data', async () => {
    const user = await seedUser('refund@example.com');
    await seedUser('refund-admin@example.com', UserRole.Admin);
    const adminCookies = await login('refund-admin@example.com');
    const cookies = await login('refund@example.com');
    const granted = await request(server)
      .post(`${prefix}/admin/subscriptions`)
      .set('Cookie', adminCookies)
      .send({
        userId: String(user._id),
        planSlug: 'basic',
        billingCycle: 'monthly',
        status: 'pending',
      });
    const checkout = await request(server)
      .post(`${prefix}/billing/checkout`)
      .set('Cookie', cookies)
      .send({ subscriptionId: granted.body.subscription.id });
    const paid = await postWebhook({
      id: 'evt_refund_1',
      type: 'checkout.session.completed',
      data: {
        sessionId: checkout.body.sessionId,
        paymentIntentId: `fake_pi_${checkout.body.paymentId}`,
        amountCents: 999,
        currency: 'usd',
        metadata: { paymentId: checkout.body.paymentId },
      },
    });
    expect(paid.status).toBe(200);

    const listed = await request(server)
      .get(`${prefix}/admin/billing/payments`)
      .set('Cookie', adminCookies);
    expect(listed.status).toBe(200);
    const captured = listed.body.payments.find((row: { status: string }) => row.status === 'success');
    expect(JSON.stringify(listed.body)).not.toMatch(/\b(?:cvv|cvc|cardNumber)\b/i);

    const refunded = await request(server)
      .post(`${prefix}/admin/billing/payments/${captured.id}/refund`)
      .set('Cookie', adminCookies)
      .send({});
    expect(refunded.status).toBe(201);
    expect(refunded.body.payment.status).toBe('refunded');

    const forbidden = await request(server)
      .get(`${prefix}/admin/billing/payments`)
      .set('Cookie', cookies);
    expect(forbidden.status).toBe(403);
  });
});
