# AmarPin — aaPanel VPS full deploy guide

Production setup used for **movies.amarpin.com** (Ubuntu VPS + aaPanel + Docker + Nginx + SSL).

| URL | Role |
|-----|------|
| `https://movies.amarpin.com` | Next.js web (port **3001** on localhost) |
| `https://movies.api.amarpin.com` | NestJS API (port **4001** on localhost) |

aaPanel Nginx owns **80/443**. Docker ports **3001** and **4001** must stay on `127.0.0.1` only — do not open them in the firewall.

---

## 1. VPS requirements

1. Ubuntu 22/24 with **aaPanel** installed.
2. **Nginx** + **Docker** (Docker Manager or Docker CE).
3. Firewall: allow `22`, `80`, `443`, aaPanel port. Block public `3001` / `4001`.
4. DNS A records → VPS IP:
   - `movies.amarpin.com`
   - `movies.api.amarpin.com`

---

## 2. Clone project

```bash
mkdir -p /www/wwwroot/movies.amarpin.com
cd /www/wwwroot/movies.amarpin.com
git clone https://github.com/NowsinJuthi/Movie-Server.git .
```

---

## 3. Environment (`.env`)

```bash
cp deploy/aapanel/.env.aapanel.example .env
nano .env
```

### Required changes

| Variable | Example / notes |
|----------|-----------------|
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` |
| `LICENSE_MASTER_SECRET` | Separate HMAC secret for license keys |
| `BOOTSTRAP_SUPERADMIN_EMAIL` | First admin email |
| `BOOTSTRAP_SUPERADMIN_PASSWORD` | Strong password |
| `MONGODB_URI` | Local `mongodb://mongo:27017/cinevault` **or** MongoDB Atlas `mongodb+srv://...` |
| `CORS_ORIGINS` | `https://movies.amarpin.com` |
| `COOKIE_DOMAIN` | `.amarpin.com` (share cookies across subdomains) |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAME_SITE` | `lax` |
| `APP_URL` | `https://movies.amarpin.com` |
| `API_URL` | `https://movies.api.amarpin.com` |
| `NEXT_PUBLIC_API_URL` | `https://movies.api.amarpin.com/api/v1` (baked into web Docker build) |
| `PAYMENT_PROVIDER` | `stripe` on public HTTPS (not `fake`) |

### MongoDB Atlas (recommended for production)

In `.env`:

```env
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/Movie-Server?retryWrites=true&w=majority
```

- Whitelist the VPS IP in Atlas → Network Access.
- API reads `MONGODB_URI` from `.env` via `env_file` — do not hardcode Atlas URI in `docker-compose.aapanel.yml`.
- You can stop/remove the local `mongo` container if you only use Atlas (optional).

### Host media folders

Created automatically by `deploy.sh`:

```text
/data/movies.amarpin.com/media/movies
/data/movies.amarpin.com/media/tv
/data/movies.amarpin.com/smb-mounts
```

---

## 4. Start Docker stack

```bash
chmod +x deploy/aapanel/deploy.sh
./deploy/aapanel/deploy.sh
```

Or manually:

```bash
mkdir -p /data/movies.amarpin.com/media/movies /data/movies.amarpin.com/media/tv /data/movies.amarpin.com/smb-mounts
docker compose -f docker-compose.aapanel.yml up -d --build
```

### Verify (on VPS)

```bash
docker compose -f docker-compose.aapanel.yml ps
curl -sS http://127.0.0.1:4001/api/v1/health
# {"status":"ok","mongo":"up","redis":"up"}

curl -I http://127.0.0.1:3001
```

### API container notes (Samba / CIFS)

The API image includes `smbclient`, `cifs-utils`, `ffmpeg`. For Samba library scanning the API service has:

- `cap_add: SYS_ADMIN`
- `privileged: true`
- `security_opt: apparmor:unconfined`

Recreate API after compose changes:

```bash
docker compose -f docker-compose.aapanel.yml up -d --build --force-recreate api
```

---

## 5. aaPanel Nginx + SSL

Create **two** websites in aaPanel. Enable **Let's Encrypt** on both (Force HTTPS).

### A) Web — `movies.amarpin.com`

1. **Website → Add site**
2. **SSL → Let's Encrypt**
3. **Config** → merge `deploy/aapanel/nginx-web.conf` with aaPanel SSL paths

**Critical Nginx rules:**

- `location ^~ /api/v1/` → `proxy_pass http://127.0.0.1:4001;` (**must be before** `location /`)
- `location /` → `proxy_pass http://127.0.0.1:3001;`
- Remove `include extension/movies.amarpin.com/*.conf` if aaPanel added it — it can steal `POST /api/v1/*` and return HTML 502/404.
- CSP `connect-src` must allow the API origin if the browser calls `movies.api.amarpin.com` directly.

Example API proxy block:

```nginx
location ^~ /api/v1/ {
    proxy_pass http://127.0.0.1:4001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Reload:

```bash
nginx -t && nginx -s reload
```

### B) API — `movies.api.amarpin.com`

1. **Website → Add site**
2. **SSL → Let's Encrypt**
3. **Config** → paste `deploy/aapanel/nginx-api.conf`

Verify:

```bash
curl -sS https://movies.api.amarpin.com/api/v1/health
curl -sS https://movies.amarpin.com/api/v1/health
```

---

## 6. First login

Admin is created from `.env` on first API boot (if no admin exists):

- Email: `BOOTSTRAP_SUPERADMIN_EMAIL`
- Password: `BOOTSTRAP_SUPERADMIN_PASSWORD`

Test login from VPS:

```bash
curl -c /tmp/cv2.txt -sS -X POST https://movies.amarpin.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"YOUR_ADMIN_EMAIL","password":"YOUR_PASSWORD"}'
```

Then:

1. **Admin → System → Settings** — site name, logo, SMTP
2. **Admin → System → License** — activate key (30-day trial otherwise)
3. **Admin → Libraries / Samba** — attach media

---

## 7. Samba / SMB file manager

### How it works

| Step | Tool | Notes |
|------|------|-------|
| Add server (test connection) | `smbclient` inside API | Safe in Docker (no Node crash) |
| Browse folders | `smbclient ls` | Human-readable output parsed by API |
| Add library + scan | CIFS **mount** | Needs mounted path for FFmpeg / filesystem scan |

### Add Samba server (Admin → File manager)

- **Host:** Samba server IP (e.g. `103.114.38.211`)
- **Port:** `445`
- **Share:** share name (e.g. `12TB-Storage`)
- **User / password:** Samba account (`pdbedit -L` / `smbpasswd`), not necessarily your PC login
- **Domain:** leave blank unless domain-joined

### If “Add current folder” fails with mount error

**Option A — recreate API with privileged mode (after `git pull`):**

```bash
cd /www/wwwroot/movies.amarpin.com
git checkout -- docker-compose.aapanel.yml
git pull
docker compose -f docker-compose.aapanel.yml up -d --build --force-recreate api
```

**Option B — pre-mount on the VPS host** (bind-mount is shared with container):

```bash
chmod +x deploy/aapanel/mount-smb-share.sh
./deploy/aapanel/mount-smb-share.sh SERVER_ID HOST SHARE USER 'PASSWORD'
```

Example:

```bash
./deploy/aapanel/mount-smb-share.sh \
  6aa46905f1680d12ad62aac1 \
  103.114.38.211 \
  12TB-Storage \
  sohelonlineit \
  'your-samba-password'
```

Then retry **Add current folder** in the admin UI.

### Samba troubleshooting

```bash
# Port open from API container?
docker compose -f docker-compose.aapanel.yml exec api smbclient --version

# Test browse API (replace SERVER_ID, use login cookie)
curl -b /tmp/cv2.txt -sS "https://movies.amarpin.com/api/v1/admin/smb-servers/SERVER_ID/browse" | head -c 500

# API logs after failed add
docker compose -f docker-compose.aapanel.yml logs api --tail 40
```

---

## 8. Media libraries

Create libraries manually in **Admin → Media libraries** (local folder or Samba). The API no longer auto-creates “Movies” / “TV” entries on deploy or restart.

Host media folders (`/data/media/movies`, `/data/media/tv`) are still bind-mounted for when you add a local library yourself.

---

## 9. Updates from GitHub

```bash
cd /www/wwwroot/movies.amarpin.com
git pull
```

If pull fails on local edits:

```bash
git checkout -- docker-compose.aapanel.yml docker/api.Dockerfile
git pull
./deploy/aapanel/deploy.sh
```

After changing `NEXT_PUBLIC_API_URL`, rebuild **web** too:

```bash
docker compose -f docker-compose.aapanel.yml up -d --build web
```

---

## 10. Useful commands

```bash
# Status
docker compose -f docker-compose.aapanel.yml ps

# Logs
docker compose -f docker-compose.aapanel.yml logs -f api
docker compose -f docker-compose.aapanel.yml logs -f web

# Restart
docker compose -f docker-compose.aapanel.yml restart api web

# Nginx
nginx -t && nginx -s reload
```

---

## 11. Common errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot reach the API server` in browser | Wrong API URL / Nginx routing / CSP | Use `nginx-web.conf`; ensure `^~ /api/v1/` proxies to `:4001` |
| `POST /api/v1/*` returns HTML 502 | aaPanel extension config steals API routes | Remove `include extension/.../*.conf` |
| Samba add crashes API (HTTP 000) | Old `@marsaud/smb2` in Docker | Pull latest — uses `smbclient` |
| Browse shows “Empty folder” but files exist | Wrong `smbclient -g` parser | Pull latest — parses `ls` output |
| `Could not mount //host/share` | CIFS needs privileged or host mount | `privileged: true` in compose or `mount-smb-share.sh` |
| `401` on curl with cookie | Session expired | Login again → `/tmp/cv2.txt` |
| `git pull` blocked on compose | Local server edits | `git checkout -- docker-compose.aapanel.yml && git pull` |

---

## 12. File reference

| File | Purpose |
|------|---------|
| `docker-compose.aapanel.yml` | Production stack (api, web, redis, optional mongo) |
| `deploy/aapanel/.env.aapanel.example` | Env template |
| `deploy/aapanel/nginx-web.conf` | Web site + `/api/v1` proxy |
| `deploy/aapanel/nginx-api.conf` | API subdomain |
| `deploy/aapanel/deploy.sh` | Build & up helper |
| `deploy/aapanel/mount-smb-share.sh` | Host-side Samba mount for library scan |
| `docker/api.Dockerfile` | API image (`smbclient`, `cifs-utils`, ffmpeg) |
| `docker/web.Dockerfile` | Web image (Next.js standalone) |

---

## 13. Stripe webhook (optional)

Webhook URL:

```text
https://movies.api.amarpin.com/api/v1/billing/webhooks/stripe
```

Do **not** run root `docker-compose.yml` (port 80 nginx) alongside aaPanel on the same VPS.
