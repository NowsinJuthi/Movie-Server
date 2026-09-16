# AmarPin (Movie-Server)

Emby-style private media platform with Netflix-style profiles, subscriptions, and secure streaming. Built as a monorepo: **Next.js** web app + **NestJS** API + **MongoDB** + **Redis**.

| | |
|---|---|
| **Web** | http://localhost:3000 (PC + VPS localhost) |
| **API** | http://localhost:4000/api/v1 |
| **Public** | https://movies.amarpin.com · https://movies.api.amarpin.com |
| **Health** | `GET http://127.0.0.1:4000/api/v1/health` |
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
| Media | FFmpeg / FFprobe on API host |
| Deploy | **systemd + aaPanel Nginx** (movies.amarpin.com) · Docker optional |

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

## Production on aaPanel (Ubuntu VPS — movies.amarpin.com)

Live stack: **systemd** (`amarpin-api` + `amarpin-web`) · **aaPanel Nginx** · **MongoDB Atlas** · **local Redis** · files under **`storage/`** · Samba via one-time mount helper.

| | |
|---|---|
| **Project root** | `/www/wwwroot/movies.amarpin.com/` |
| **Web** | systemd → localhost **3000** |
| **API** | systemd (`www` user) → localhost **4000** |
| **Public** | Nginx 443 → 3000 / 4000 |
| **Env template** | [`.env.ready`](.env.ready) |

### Deploy guides

| Guide | Use |
|-------|-----|
| **[deploy/aapanel/README.md](deploy/aapanel/README.md)** | Full production doc (storage, Samba, nginx, updates) |
| **[deploy/aapanel/VPS-SYSTEMD-DEPLOY.md](deploy/aapanel/VPS-SYSTEMD-DEPLOY.md)** | Short step-by-step checklist |
| **[deploy/aapanel/PORTS.md](deploy/aapanel/PORTS.md)** | Port map (PC = VPS) |

### Quick verify (VPS)

```bash
curl -sS http://127.0.0.1:4000/api/v1/health
curl -I http://127.0.0.1:3000
curl -sS https://movies.api.amarpin.com/api/v1/health
sudo systemctl is-active amarpin-api amarpin-web
```

### Samba (website-only)

One-time on VPS, then add shares only in Admin → File manager:

```bash
sudo bash deploy/aapanel/install-smb-mount-helper.sh
sudo systemctl restart amarpin-api
```

### aaPanel tips (বাংলা সংক্ষেপ)

1. PC ar VPS **same port**: web **3000**, API **4000**।
2. Firewall-এ শুধু `80/443` পাবলিক — `3000`/`4000` localhost-এ রাখুন।
3. সব upload/HLS/Samba mount → `storage/` folder (`.env.ready` দেখুন)।
4. MongoDB reset হলে: `npm run bootstrap:admin` → libraries/Samba আবার add।
5. Full guide: [deploy/aapanel/README.md](deploy/aapanel/README.md)

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