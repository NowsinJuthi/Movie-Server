# AmarPin (Movie-Server)

**AmarPin** is a private, Emby-style media platform with a Netflix-style viewer experience: multi-profile accounts, subscription plans, and server-controlled streaming. The public site runs at **[movies.amarpin.com](https://movies.amarpin.com)**; the API is served at **[movies.api.amarpin.com](https://movies.api.amarpin.com)**.

This repository is a monorepo:

| Package | Role |
|---------|------|
| `apps/web` | Next.js viewer + admin UI |
| `apps/api` | NestJS REST API (`/api/v1`) |
| `packages/shared` | Shared TypeScript types and constants |

---

## Quick reference

| | |
|---|---|
| **Web (local)** | http://localhost:3000 |
| **API (local)** | http://localhost:4000/api/v1 |
| **Health** | `GET /api/v1/health` |
| **Viewer app** | `/home` (after login and profile selection) |
| **Admin** | `/admin` (`admin` or `super_admin`) |
| **Product license** | `/license` · Admin → System → License |
| **Site branding & SMTP** | Admin → System → Settings |

---

## Public website (movies.amarpin.com)

What subscribers and family members use day to day:

### Accounts
- Email registration, verification, login, password reset
- Secure sessions (JWT access cookie + rotating refresh tokens)
- Account billing and subscription management under **Account**

### Profiles
- Multiple profiles per account (avatars, display language, kids mode, optional PIN)
- Per-profile **My List**, **Favorites**, **Watch history**, and **Continue watching**
- Personalized home rows and search

### Catalog & playback
- Movies and TV series (seasons and episodes)
- Library browsing from curated **Home** rows and per-library menus
- **Search** across the catalog
- Playback uses **server-issued streaming sessions** (the browser is not trusted with raw file paths)
- Stream quality and concurrent streams are enforced from the active **subscription plan**
- Adaptive delivery: progressive streaming where supported; **HLS** where the device requires it (for example iOS), with remux/transcode handled on the API host via FFmpeg

### Subscriptions
- Public **Subscribe** flow with plan tiers (for example SD / HD / UHD) and stream limits
- Stripe in production, or a local **fake** payment provider for development

### Movie upload requests
- When enabled by an administrator, members can open **Upload Request** from the site header and ask for new titles
- Staff review and update requests in **Admin → Upload requests**

---

## Admin panel (`/admin`)

Role-based access with granular permissions. Main areas:

| Area | Purpose |
|------|---------|
| **Dashboard** | Live counts (users, catalog, billing, libraries, scans), Redis-backed **live sessions**, **server CPU / RAM / storage**, shortcuts to common tasks |
| **Menu** | Per–media-library navigation items shown on the public site |
| **System** | Health, **Settings** (site name, logo, favicon, SMTP), **License**, background **Jobs**, **Audit log**, **Roles & permissions**, **Home slider** (up to six hero titles) |
| **People** | Users and viewer profiles |
| **Billing** | Plans, subscriptions, payments and refunds |
| **Titles** | Movies, TV series, member **Upload requests** |
| **Collections & homepage** | Movie/series collections, featured/trending, homepage row CMS |
| **Metadata** | Audio/subtitle tracks, genres, tags |
| **Operations** | Media libraries, library scan jobs, **Samba file manager**, **Sessions & streams** |

### Branding
Configure the name, logo, and favicon shown on the public site from **Admin → System → Settings**. Uploaded assets are stored under `storage/uploads/branding/` on the server.

### Samba / NAS libraries
Add remote shares in **Admin → Samba file manager** (after the one-time VPS mount helper is installed). Scan libraries to import paths, match metadata, and serve files for playback.

---

## Product license (trial → lock)

- **30-day full-feature trial** from first API boot
- After trial, the API locks until a signed `CV1…` license key is activated
- HMAC-signed keys and install seal (harder to reset by wiping the database alone)
- Public activation: `/license` · Admin: **System → License**

Generate a key on a trusted machine:

```bash
npm run license:generate -- --days 365 --edition pro
# lifetime:
npm run license:generate -- --lifetime --edition pro
```

Use the same `LICENSE_MASTER_SECRET` (or `JWT_ACCESS_SECRET` fallback) as the API.

---

## Security & operations (summary)

- Redis-backed rate limits and login lockout
- Roles: `user`, `customer`, `admin`, `super_admin` with permission keys for admin routes
- SMTP for transactional mail (panel settings or `SMTP_*` env fallback; passwords encrypted at rest)
- Live play sessions and active transcodes visible under **Admin → Sessions & streams**

---

## Stack

| Layer | Technology |
|-------|------------|
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS 4, TanStack Query, Zustand |
| API | NestJS 11, Mongoose, BullMQ, Socket.IO, Nodemailer |
| Data | MongoDB, Redis |
| Media | FFmpeg / FFprobe on the API host |
| Production (live) | **systemd** + **aaPanel Nginx** on Ubuntu · Docker optional |

```
apps/api          NestJS API (/api/v1)
apps/web          Next.js client + admin
packages/shared   Shared types, roles, error codes
deploy/aapanel    Nginx samples, systemd units, VPS scripts
docker/           Dockerfiles and compose files
```

---

## Local development

**Requirements:** Node.js ≥ 20.19, Docker (Mongo + Redis recommended), npm.

```bash
cp .env.example .env
# Edit secrets (JWT_ACCESS_SECRET, BOOTSTRAP_SUPERADMIN_*, etc.)

docker compose -f docker-compose.dev.yml up -d

npm install
npm run build -w @movie-server/shared
npm run dev:api    # :4000
npm run dev:web    # :3000
```

Optional: `REDIS_HOST=memory` for API-only dev without Redis (not for production).

The first **super admin** is created from `BOOTSTRAP_SUPERADMIN_EMAIL` / `BOOTSTRAP_SUPERADMIN_PASSWORD` when none exists.

### Scripts

```bash
npm run build
npm run test:api
npm run test:api:e2e
npm run license:generate -- --days 365 --edition pro
npm run bootstrap:admin   # reset/recreate bootstrap admin (use with care)
```

### Local payments

- `PAYMENT_PROVIDER=fake` — no Stripe (not allowed on public HTTPS production origins)
- Stripe: `PAYMENT_PROVIDER=stripe`, keys, webhook → `POST /api/v1/billing/webhooks/stripe`

---

## Production on aaPanel (movies.amarpin.com)

Live VPS layout: **systemd** (`amarpin-api`, `amarpin-web`) · **aaPanel Nginx** · **MongoDB Atlas** · **local Redis** · media and uploads under **`storage/`** · Samba via the mount helper.

| | |
|---|---|
| **Project root** | `/www/wwwroot/movies.amarpin.com/` |
| **Web** | systemd → `127.0.0.1:3000` |
| **API** | systemd (`www` user) → `127.0.0.1:4000` |
| **Public** | Nginx :443 → web and API subdomains |
| **Env templates** | [`.env.example`](.env.example) · [`deploy/aapanel/.env.aapanel.example`](deploy/aapanel/.env.aapanel.example) |

### Documentation

| Guide | Use |
|-------|-----|
| **[deploy/aapanel/README.md](deploy/aapanel/README.md)** | Full production guide (storage, Samba, nginx, updates) |
| **[deploy/aapanel/VPS-SYSTEMD-DEPLOY.md](deploy/aapanel/VPS-SYSTEMD-DEPLOY.md)** | Short deploy checklist |
| **[deploy/aapanel/PORTS.md](deploy/aapanel/PORTS.md)** | Port map (PC dev matches VPS) |

### Verify on the VPS

```bash
curl -sS http://127.0.0.1:4000/api/v1/health
curl -I http://127.0.0.1:3000
curl -sS https://movies.api.amarpin.com/api/v1/health
sudo systemctl is-active amarpin-api amarpin-web
```

### Samba (website-only workflow)

One-time on the VPS, then manage shares only in the admin UI:

```bash
sudo bash deploy/aapanel/install-smb-mount-helper.sh
sudo systemctl restart amarpin-api
```

### Web-only deploy (typical UI change)

```bash
cd /www/wwwroot/movies.amarpin.com
bash deploy/aapanel/rebuild-web.sh
```

Rebuild **shared** before **API** if TypeScript types in `packages/shared` changed.

### aaPanel tips

1. PC and VPS use the **same ports**: web **3000**, API **4000** (localhost only on the VPS).
2. Open **80/443** in the firewall; do not expose **3000** / **4000** publicly.
3. Keep uploads, HLS temp files, and Samba mounts under **`storage/`** (see `.env.example`).
4. After a MongoDB reset: `npm run bootstrap:admin`, then re-add libraries and Samba shares.

---

## Alternate production (Docker Compose)

If you are **not** using aaPanel:

```bash
cp .env.example .env
docker compose up --build -d
```

This uses the root `docker-compose.yml` (includes Nginx on port 80). Do **not** run it alongside aaPanel Nginx on the same ports.

---

## Support / license vendor

Product license keys and implementation support:

- WhatsApp: [01777139777](https://wa.me/8801777139777)
- Facebook: [fb.com/uniqbd.online](https://fb.com/uniqbd.online)
- Website: [uniqbd.com](https://uniqbd.com)

---

## License

Proprietary product software. Unauthorized redistribution or license bypass is prohibited. Trial and key enforcement run on the API server.
