import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { MongoMemoryServer } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Server } from 'http';
import { AUTH_COOKIE, UserRole } from '@movie-server/shared';
import { MailService } from '../src/mail/mail.service';
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

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let mongod: MongoMemoryServer;
  let mail: MailService;
  let users: UsersService;
  let jwt: JwtService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    const { AppModule } = await import('../src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
    mail = app.get(MailService);
    users = app.get(UsersService);
    jwt = app.get(JwtService);
  }, 180000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  it('rejects invalid registration payloads', async () => {
    const res = await request(server).post(`${prefix}/auth/register`).send({
      email: 'not-an-email',
      displayName: 'A',
      password: 'weak',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_FAILED');
    expect(res.body).not.toHaveProperty('password');
  });

  it('registers, blocks login until verification, then signs in', async () => {
    const email = 'viewer@example.com';
    const register = await request(server).post(`${prefix}/auth/register`).send({
      email,
      displayName: 'Viewer One',
      password,
    });
    expect(register.status).toBe(201);
    expect(register.body.user.email).toBe(email);
    expect(register.body.user.role).toBe(UserRole.User);
    expect(register.body.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(register.body)).not.toContain(password);

    const unverifiedLogin = await request(server)
      .post(`${prefix}/auth/login`)
      .send({ email, password });
    expect(unverifiedLogin.status).toBe(403);
    expect(unverifiedLogin.body.error).toBe('EMAIL_NOT_VERIFIED');

    const token = mail.lastToken(email, 'verification');
    expect(token).toBeDefined();

    const verify = await request(server)
      .post(`${prefix}/auth/verify-email`)
      .send({ token });
    expect(verify.status).toBe(200);

    const login = await request(server).post(`${prefix}/auth/login`).send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe(email);
    expect(login.body).not.toHaveProperty('accessToken');
    expect(login.body).not.toHaveProperty('refreshToken');

    const cookies = cookieJar(login);
    expect(cookies).toContain(AUTH_COOKIE.Access);
    expect(cookies).toContain(AUTH_COOKIE.Refresh);

    const me = await request(server).get(`${prefix}/auth/me`).set('Cookie', cookies);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
  });

  it('rejects duplicate registration', async () => {
    const email = 'dup@example.com';
    await users.createUser({
      email,
      password,
      displayName: 'Dup',
      emailVerified: true,
    });
    const res = await request(server).post(`${prefix}/auth/register`).send({
      email,
      displayName: 'Dup 2',
      password,
    });
    expect(res.status).toBe(409);
  });

  it('rejects unauthenticated access to protected APIs', async () => {
    const res = await request(server).get(`${prefix}/auth/me`);
    expect(res.status).toBe(401);
  });

  it('refreshes tokens, revokes the previous refresh token, and logs out', async () => {
    const email = 'refresh@example.com';
    await users.createUser({
      email,
      password,
      displayName: 'Refresh User',
      emailVerified: true,
    });
    const login = await request(server).post(`${prefix}/auth/login`).send({ email, password });
    const cookies = cookieJar(login);

    const refresh = await request(server)
      .post(`${prefix}/auth/refresh`)
      .set('Cookie', cookies);
    expect(refresh.status).toBe(200);
    const rotated = cookieJar(refresh, cookies);

    const reuse = await request(server)
      .post(`${prefix}/auth/refresh`)
      .set('Cookie', cookies);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error).toBe('SESSION_REVOKED');

    const login2 = await request(server).post(`${prefix}/auth/login`).send({ email, password });
    const sessionCookies = cookieJar(login2);
    const logout = await request(server)
      .post(`${prefix}/auth/logout`)
      .set('Cookie', sessionCookies);
    expect(logout.status).toBe(200);

    const me = await request(server).get(`${prefix}/auth/me`).set('Cookie', sessionCookies);
    expect(me.status).toBe(401);
  });

  it('resets a password and invalidates previous sessions', async () => {
    const email = 'reset@example.com';
    await users.createUser({
      email,
      password,
      displayName: 'Reset User',
      emailVerified: true,
    });
    const login = await request(server).post(`${prefix}/auth/login`).send({ email, password });
    const cookies = cookieJar(login);

    const forgot = await request(server)
      .post(`${prefix}/auth/forgot-password`)
      .send({ email });
    expect(forgot.status).toBe(200);
    const token = mail.lastToken(email, 'password-reset');
    expect(token).toBeDefined();

    const reset = await request(server).post(`${prefix}/auth/reset-password`).send({
      token,
      password: 'NewStrong1x',
    });
    expect(reset.status).toBe(200);

    const oldLogin = await request(server).post(`${prefix}/auth/login`).send({ email, password });
    expect(oldLogin.status).toBe(401);

    const me = await request(server).get(`${prefix}/auth/me`).set('Cookie', cookies);
    expect(me.status).toBe(401);

    const nextLogin = await request(server)
      .post(`${prefix}/auth/login`)
      .send({ email, password: 'NewStrong1x' });
    expect(nextLogin.status).toBe(200);
  });

  it('rejects expired access tokens', async () => {
    const email = 'expired@example.com';
    const user = await users.createUser({
      email,
      password,
      displayName: 'Expired',
      emailVerified: true,
    });
    const login = await request(server).post(`${prefix}/auth/login`).send({ email, password });
    const cookies = cookieJar(login);
    const access = cookies
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${AUTH_COOKIE.Access}=`))
      ?.split('=')[1];
    const payload = jwt.decode(access ?? '') as Record<string, unknown>;
    const expired = jwt.sign(
      { ...payload, exp: Math.floor(Date.now() / 1000) - 10 },
      { secret: process.env.JWT_ACCESS_SECRET as string },
    );

    const res = await request(server)
      .get(`${prefix}/auth/me`)
      .set('Cookie', `${AUTH_COOKIE.Access}=${expired}`);
    expect(res.status).toBe(401);
    expect(String(user._id)).toBeTruthy();
  });

  it('enforces role-based authorization', async () => {
    await users.createUser({
      email: 'member@example.com',
      password,
      displayName: 'Member',
      emailVerified: true,
      role: UserRole.User,
    });
    await users.createUser({
      email: 'ops@example.com',
      password,
      displayName: 'Admin',
      emailVerified: true,
      role: UserRole.Admin,
    });
    const superAdmin = await users.createUser({
      email: 'root@example.com',
      password,
      displayName: 'Root',
      emailVerified: true,
      role: UserRole.SuperAdmin,
    });

    const memberLogin = await request(server)
      .post(`${prefix}/auth/login`)
      .send({ email: 'member@example.com', password });
    const adminLogin = await request(server)
      .post(`${prefix}/auth/login`)
      .send({ email: 'ops@example.com', password });
    const rootLogin = await request(server)
      .post(`${prefix}/auth/login`)
      .send({ email: 'root@example.com', password });

    const memberCookies = cookieJar(memberLogin);
    const adminCookies = cookieJar(adminLogin);
    const rootCookies = cookieJar(rootLogin);

    const denied = await request(server)
      .get(`${prefix}/admin/users`)
      .set('Cookie', memberCookies);
    expect(denied.status).toBe(403);

    const allowed = await request(server)
      .get(`${prefix}/admin/users`)
      .set('Cookie', adminCookies);
    expect(allowed.status).toBe(200);
    expect(Array.isArray(allowed.body.users)).toBe(true);

    const adminCannotPromote = await request(server)
      .patch(`${prefix}/admin/users/${String(superAdmin._id)}/role`)
      .set('Cookie', adminCookies)
      .send({ role: UserRole.User });
    expect(adminCannotPromote.status).toBe(403);

    const adminCreateCustomer = await request(server)
      .post(`${prefix}/admin/users`)
      .set('Cookie', adminCookies)
      .send({
        email: 'created-customer@example.com',
        displayName: 'Created Customer',
        password,
        role: UserRole.Customer,
      });
    expect(adminCreateCustomer.status).toBe(201);
    expect(adminCreateCustomer.body.user.role).toBe(UserRole.Customer);

    const adminCreateUser = await request(server)
      .post(`${prefix}/admin/users`)
      .set('Cookie', adminCookies)
      .send({
        email: 'created-by-admin@example.com',
        displayName: 'Created User',
        password,
      });
    expect(adminCreateUser.status).toBe(201);
    expect(adminCreateUser.body.user.email).toBe('created-by-admin@example.com');
    expect(adminCreateUser.body.user.role).toBe(UserRole.User);
    expect(adminCreateUser.body.user.emailVerified).toBe(true);
    expect(adminCreateUser.body.user).not.toHaveProperty('passwordHash');

    const promoteToCustomer = await request(server)
      .patch(`${prefix}/admin/users/${adminCreateUser.body.user.id}/role`)
      .set('Cookie', adminCookies)
      .send({ role: UserRole.Customer });
    expect(promoteToCustomer.status).toBe(200);
    expect(promoteToCustomer.body.user.role).toBe(UserRole.Customer);

    const adminCannotCreateAdmin = await request(server)
      .post(`${prefix}/admin/users`)
      .set('Cookie', adminCookies)
      .send({
        email: 'new-admin@example.com',
        displayName: 'New Admin',
        password,
        role: UserRole.Admin,
      });
    expect(adminCannotCreateAdmin.status).toBe(403);

    const rootCreateAdmin = await request(server)
      .post(`${prefix}/admin/users`)
      .set('Cookie', rootCookies)
      .send({
        email: 'new-admin@example.com',
        displayName: 'New Admin',
        password,
        role: UserRole.Admin,
      });
    expect(rootCreateAdmin.status).toBe(201);
    expect(rootCreateAdmin.body.user.role).toBe(UserRole.Admin);

    const promote = await request(server)
      .patch(`${prefix}/admin/users/${String(superAdmin._id)}/role`)
      .set('Cookie', rootCookies)
      .send({ role: UserRole.Admin });
    expect(promote.status).toBe(200);
    expect(promote.body.user.role).toBe(UserRole.Admin);
  });

  it('lets admins edit and delete end-user accounts', async () => {
    await users.createUser({
      email: 'editor-admin@example.com',
      password,
      displayName: 'Editor Admin',
      emailVerified: true,
      role: UserRole.Admin,
    });
    const target = await users.createUser({
      email: 'editable@example.com',
      password,
      displayName: 'Editable',
      emailVerified: true,
      role: UserRole.User,
    });

    const adminLogin = await request(server)
      .post(`${prefix}/auth/login`)
      .send({ email: 'editor-admin@example.com', password });
    const adminCookies = cookieJar(adminLogin);

    const edited = await request(server)
      .patch(`${prefix}/admin/users/${String(target._id)}`)
      .set('Cookie', adminCookies)
      .send({
        displayName: 'Edited Name',
        email: 'edited@example.com',
        role: UserRole.Customer,
        emailVerified: true,
        isActive: true,
      });
    expect(edited.status).toBe(200);
    expect(edited.body.user.displayName).toBe('Edited Name');
    expect(edited.body.user.email).toBe('edited@example.com');
    expect(edited.body.user.role).toBe(UserRole.Customer);

    const deleted = await request(server)
      .delete(`${prefix}/admin/users/${String(target._id)}`)
      .set('Cookie', adminCookies);
    expect(deleted.status).toBe(200);
    expect(deleted.body.id).toBe(String(target._id));
  });

  it('locks an account after repeated failed logins', async () => {
    const email = 'lockme@example.com';
    await users.createUser({
      email,
      password,
      displayName: 'Lock Me',
      emailVerified: true,
    });

    for (let i = 0; i < 5; i += 1) {
      const res = await request(server)
        .post(`${prefix}/auth/login`)
        .send({ email, password: 'WrongPass1x' });
      expect(res.status).toBe(401);
    }

    const locked = await request(server).post(`${prefix}/auth/login`).send({ email, password });
    expect(locked.status).toBe(403);
    expect(locked.body.error).toBe('ACCOUNT_LOCKED');
  });
});
