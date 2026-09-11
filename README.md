# CineVault (Movie-Server)

Emby-style private media platform with Netflix-style profiles, subscriptions, and secure streaming. Built as a monorepo: **Next.js** web app + **NestJS** API + **MongoDB** + **Redis**.

| | |
|---|---|
| **Web** | http://localhost:3001 (dev) |
| **API** | http://localhost:4001/api/v1 |
| **Health** | `GET /api/v1/health` |
| **Admin** | `/admin` (admin / super_admin) |
| **License** | `/license` · Admin → System → License |
| **Settings** | Admin → System → Settings (SMTP, name, logo, favicon) |

---

## Features

### Accounts & security
- Register / login with email verification and password reset
- JWT access cookie + rotating refresh sessions
- Roles: `user`, `customer`, `admin`, `super_admin`
- Redis rate limits and login lockout

### Profiles & personalization
- Multiple profiles per account (kids mode, PIN, languages)
- My List, Favorites, Watch history, Continue Watching
- Recommendations and search

### Catalog & libraries
- Movies and TV series with seasons/episodes
- Media library scanner (FFprobe / FFmpeg)
- Samba / SMB file manager for remote shares
- Artwork, tracks (audio/subtitles), collections, homepage CMS

### Subscriptions & billing
- Plans (SD / HD / UHD) with stream limits
- Stripe or local `fake` provider for development
- Invoices, webhooks, admin refunds

### Streaming
- Server-issued playback sessions (browser is not trusted)
- Quality capped by plan entitlement
- Live sessions visible in admin

### Product license (trial → lock)
- **30-day full-feature trial** from first API boot
- After trial, the API locks until a signed `CV1…` key is activated
- HMAC-signed keys + install seal (harder to reset by wiping DB alone)
- Public page: `/license` · Admin: **System → License**
- Generate a key (vendor machine):

```bash
npm run license:generate -- --days 365 --edition pro
# lifetime:
npm run license:generate -- --lifetime --edition pro
```

Use the same `LICENSE_MASTER_SECRET` (or `JWT_ACCESS_SECRET` fallback) as the API.

### System settings
Configure from **Admin → System → Settings**:
- Website name, logo, favicon
- SMTP host / port / user / password / from address
- Send test email

SMTP password is encrypted at rest. If panel SMTP is disabled, the API falls back to `SMTP_*` env vars.

---

## Stack

| Layer | Tech |
|------|------|
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS 4, TanStack Query, Zustand |
| API | NestJS 11, Mongoose 9, BullMQ, Socket.IO, Nodemailer |
| Data | MongoDB 8, Redis 7 |
| Media | FFmpeg / FFprobe in API image |
| Deploy | Docker Compose + Nginx (aaPanel or included compose) |

```
apps/api          NestJS API (/api/v1)
apps/web          Next.js client
packages/shared   Shared types, roles, error codes
deploy/aapanel    aaPanel Nginx + deploy helper
docker/           Dockerfiles
```

---

## Local development

**Requirements:** Node.js ≥ 20.19, Docker (Mongo + Redis), npm.

```bash
cp .env.example .env
# edit secrets (JWT_ACCESS_SECRET, BOOTSTRAP_SUPERADMIN_*, etc.)

docker compose -f docker-compose.dev.yml up -d

npm install
npm run build -w @movie-server/shared
npm run dev:api    # :4001
npm run dev:web    # :3001
```

Optional: `REDIS_HOST=memory` for API without Redis (dev only).

Default Super Admin comes from `BOOTSTRAP_SUPERADMIN_EMAIL` / `BOOTSTRAP_SUPERADMIN_PASSWORD` when none exists.

### Useful scripts

```bash
npm run build
npm run test:api
npm run test:api:e2e
npm run license:generate -- --days 365 --edition pro
```

### Local payments

- `PAYMENT_PROVIDER=fake` — no Stripe needed (not allowed on public HTTPS production origins)
- Stripe: set `PAYMENT_PROVIDER=stripe`, keys, and webhook → `POST /api/v1/billing/webhooks/stripe`

---

## Production on aaPanel (Ubuntu VPS)

**Full deploy guide (Nginx, SSL, MongoDB Atlas, Samba, troubleshooting):**

→ **[deploy/aapanel/README.md](deploy/aapanel/README.md)**

Quick start on the VPS:

```bash
mkdir -p /www/wwwroot/movies.amarpin.com
cd /www/wwwroot/movies.amarpin.com
git clone https://github.com/NowsinJuthi/Movie-Server.git .
cp deploy/aapanel/.env.aapanel.example .env
nano .env   # JWT secret, admin password, MONGODB_URI, domains
chmod +x deploy/aapanel/deploy.sh
./deploy/aapanel/deploy.sh
```

Then aaPanel: two sites + SSL → `nginx-web.conf` + `nginx-api.conf`.

| Check | Command |
|-------|---------|
| API health | `curl -sS http://127.0.0.1:4001/api/v1/health` |
| Web | `curl -I http://127.0.0.1:3001` |
| Public | `https://movies.amarpin.com` |

### aaPanel tips (বাংলা সংক্ষেপ)

1. aaPanel-এ Nginx + Docker; firewall-এ শুধু `80/443` পাবলিক রাখুন (`3001`/`4001` নয়)।
2. প্রজেক্ট `/www/wwwroot/movies.amarpin.com`-এ clone, `.env` সেট করুন (Atlas MongoDB URI, JWT, admin password)।
3. `./deploy/aapanel/deploy.sh` চালান।
4. দুইটা site + SSL: `movies.amarpin.com` (web) ও `movies.api.amarpin.com` (API) — config `deploy/aapanel/` থেকে।
5. Nginx-এ `location ^~ /api/v1/` অবশ্যই `127.0.0.1:4001`-এ proxy করবে।
6. Samba library add-এ CIFS mount লাগে — API `privileged: true` অথবা `deploy/aapanel/mount-smb-share.sh` host-এ চালান।
7. বিস্তারিত: [deploy/aapanel/README.md](deploy/aapanel/README.md)

---

## Alternate production (compose Nginx)

If you are **not** using aaPanel:

```bash
cp .env.example .env
# edit production values
docker compose up --build -d
```

This uses the root `docker-compose.yml` (includes Nginx on 80). Do **not** run it alongside aaPanel Nginx on the same ports.

---

## Support / license vendor

Need a product license key?

- WhatsApp: [01777139777](https://wa.me/8801777139777)
- Facebook: [fb.com/uniqbd.online](https://fb.com/uniqbd.online)
- Website: [uniqbd.com](https://uniqbd.com)

---

## License

Proprietary product software. Unauthorized redistribution or license bypass is prohibited. Trial and key enforcement run on the API server.