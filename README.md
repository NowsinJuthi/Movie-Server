# CineVault (Movie-Server)

Emby-style private media platform with Netflix-style profiles, subscriptions, and secure streaming. Built as a monorepo: **Next.js** web app + **NestJS** API + **MongoDB** + **Redis**.

| | |
|---|---|
| **Web** | http://localhost:3000 (dev) |
| **API** | http://localhost:4000/api/v1 |
| **Health** | `GET /api/v1/health` |
| **Admin** | `/admin` (admin / super_admin) |
| **License** | `/license` · Admin → System → License |
| **Settings** | Admin → System → Settings (SMTP, name, logo, favicon) |

---

## Features

### Accounts & security
- Register / login with email verification and password reset
- JWT access cookie + rotating refresh sessions
- Roles: `user`, `admin`, `super_admin`
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
npm run dev:api    # :4000
npm run dev:web    # :3000
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

aaPanel Nginx owns **80/443** (SSL). Docker runs Mongo, Redis, API, and Web bound to **localhost only** (`127.0.0.1:3000` / `4000`). Do **not** expose 3000/4000 publicly.

### Files

| File | Purpose |
|------|---------|
| `docker-compose.aapanel.yml` | Production compose (no container Nginx on :80) |
| `deploy/aapanel/.env.aapanel.example` | Env template → copy to `.env` |
| `deploy/aapanel/nginx-site.conf` | Reverse proxy snippets for aaPanel |
| `deploy/aapanel/deploy.sh` | Build & up helper |
| `deploy/aapanel/README.md` | Short deploy checklist |

### 1) Prepare the VPS

1. Install **aaPanel** on Ubuntu 24.
2. Install **Nginx** and **Docker** (Docker Manager or Docker CE).
3. Firewall: `22`, `80`, `443`, aaPanel port. Block public access to `3000`/`4000`.

### 2) Upload the project

```bash
mkdir -p /www/wwwroot/cinevault
# git clone <this-repo-url> /www/wwwroot/cinevault
cd /www/wwwroot/cinevault
```

### 3) Environment

```bash
cp deploy/aapanel/.env.aapanel.example .env
nano .env
```

Set at least:

| Variable | Notes |
|----------|--------|
| `APP_URL` / `API_URL` / `CORS_ORIGINS` | `https://yourdomain.com` |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` |
| `LICENSE_MASTER_SECRET` | Separate HMAC secret for license keys (recommended) |
| `BOOTSTRAP_SUPERADMIN_EMAIL` / `PASSWORD` | First admin |
| `PAYMENT_WEBHOOK_SECRET` | Strong unique value |
| `PAYMENT_PROVIDER` | Real Stripe on public HTTPS (not `fake`) |
| `CINEVAULT_MEDIA_HOST` | Host media root (default `/data/cinevault/media`) |

```bash
openssl rand -hex 32
```

### 4) Start containers

```bash
chmod +x deploy/aapanel/deploy.sh
./deploy/aapanel/deploy.sh
```

Or:

```bash
mkdir -p /data/cinevault/media/movies /data/cinevault/media/tv /data/cinevault/smb-mounts
docker compose -f docker-compose.aapanel.yml up -d --build
```

Verify on the server:

```bash
curl -sS http://127.0.0.1:4000/api/v1/health
curl -I http://127.0.0.1:3000
docker compose -f docker-compose.aapanel.yml ps
```

### 5) aaPanel website + SSL

1. **Website → Add site** → `yourdomain.com`
2. **SSL → Let’s Encrypt** → Force HTTPS
3. Open site **Config** and apply proxy rules from `deploy/aapanel/nginx-site.conf`:
   - `/api/` → `http://127.0.0.1:4000`
   - `/socket.io/` → `http://127.0.0.1:4000` (WebSocket upgrade)
   - `/` → `http://127.0.0.1:3000`
4. Reload Nginx

### 6) After go-live

1. Log in with the bootstrap Super Admin.
2. **Admin → System → Settings** — site name, logo, favicon, SMTP.
3. **Admin → System → License** — activate product key (or rely on 30-day trial).
4. **Admin → Libraries / Samba** — attach media paths.
5. **Admin → Plans / Billing** — configure subscription plans and Stripe if needed.

### 7) Updates

```bash
cd /www/wwwroot/cinevault
git pull
./deploy/aapanel/deploy.sh
```

### 8) Logs & restart

```bash
docker compose -f docker-compose.aapanel.yml logs -f api
docker compose -f docker-compose.aapanel.yml logs -f web
docker compose -f docker-compose.aapanel.yml restart api web
```

### aaPanel tips (বাংলা সংক্ষেপ)

1. aaPanel-এ Nginx + Docker ইনস্টল করুন; পাবলিক পোর্ট শুধু `80/443`।
2. প্রজেক্ট `/www/wwwroot/cinevault`-এ ক্লোন করুন, `.env` সেট করুন।
3. `./deploy/aapanel/deploy.sh` চালান।
4. ডোমেইন সাইট বানিয়ে SSL চালু করুন; Nginx-এ `nginx-site.conf` প্রক্সি বসান।
5. অ্যাডমিন থেকে Settings (SMTP/লোগো) ও License কী অ্যাক্টিভেট করুন।

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
