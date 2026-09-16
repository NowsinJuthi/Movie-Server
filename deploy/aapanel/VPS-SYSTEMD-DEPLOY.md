# AmarPin — VPS deploy checklist (systemd)

Quick reference for **movies.amarpin.com** — Node.js + systemd + aaPanel Nginx.

**Ports:** Web **3000**, API **4000** (same as PC dev).

→ Full guide: [README.md](./README.md)

---

## Stack summary

| Component | How |
|-----------|-----|
| Web | `amarpin-web.service` → Next.js standalone on `:3000` |
| API | `amarpin-api.service` → NestJS on `:4000` (user `www`) |
| MongoDB | Atlas (`MONGODB_URI` in `.env`) |
| Redis | Local `127.0.0.1:6379` |
| Media files | Samba NAS + `storage/` on VPS |
| Public HTTPS | aaPanel Nginx → localhost 3000 / 4000 |

---

## Port map

| | Port | Health |
|---|------|--------|
| Web | **3000** | `curl -I http://127.0.0.1:3000` |
| API | **4000** | `curl -sS http://127.0.0.1:4000/api/v1/health` |
| Public | 443 | `https://movies.api.amarpin.com/api/v1/health` |

---

## Step 1 — Upload project

VPS root: `/www/wwwroot/movies.amarpin.com/`

Upload from PC (FTP / aaPanel File Manager) or clone:

```bash
mkdir -p /www/wwwroot/movies.amarpin.com
cd /www/wwwroot/movies.amarpin.com
git clone https://github.com/NowsinJuthi/Movie-Server.git .
npm install
```

Minimum upload set for partial updates:

| Path | Notes |
|------|-------|
| `apps/api/src/` | API source |
| `apps/web/src/` | Web source |
| `packages/shared/src/` | Shared types |
| `deploy/aapanel/` | systemd, nginx, Samba scripts |
| `.env` | From `.env.ready` |

---

## Step 2 — Storage folders

```bash
sudo mkdir -p /www/wwwroot/movies.amarpin.com/storage/uploads/{artwork,avatars,branding} \
  /www/wwwroot/movies.amarpin.com/storage/hls-pack \
  /www/wwwroot/movies.amarpin.com/storage/smb-mounts
sudo chown -R www:www /www/wwwroot/movies.amarpin.com/storage
sudo chmod -R 755 /www/wwwroot/movies.amarpin.com/storage
```

---

## Step 3 — `.env`

```bash
cp .env.ready .env
nano .env
```

Key production values:

```env
NODE_ENV=production
PORT=4000
APP_URL=https://movies.amarpin.com
API_URL=https://movies.api.amarpin.com
API_INTERNAL_URL=http://127.0.0.1:4000
NEXT_PUBLIC_API_URL=https://movies.api.amarpin.com/api/v1
COOKIE_SECURE=true
COOKIE_DOMAIN=.amarpin.com
CORS_ORIGINS=https://movies.amarpin.com

MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/Movie-Server?...
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

ARTWORK_UPLOAD_DIR=/www/wwwroot/movies.amarpin.com/storage/uploads/artwork
AVATAR_UPLOAD_DIR=/www/wwwroot/movies.amarpin.com/storage/uploads/avatars
BRANDING_UPLOAD_DIR=/www/wwwroot/movies.amarpin.com/storage/uploads/branding
HLS_PACK_DIR=/www/wwwroot/movies.amarpin.com/storage/hls-pack
SMB_MOUNT_ROOT=/www/wwwroot/movies.amarpin.com/storage/smb-mounts
SMB_MOUNT_USE_SUDO=true

BOOTSTRAP_SUPERADMIN_EMAIL=admin@example.com
BOOTSTRAP_SUPERADMIN_PASSWORD=ChangeMe_Admin_123!
```

---

## Step 4 — Build

```bash
cd /www/wwwroot/movies.amarpin.com
npm run build -w @movie-server/shared
npm run build -w @movie-server/api
npm run build -w @movie-server/web
```

Permission fix if build fails:

```bash
sudo rm -rf apps/api/dist apps/web/.next
sudo chown -R $USER:www /www/wwwroot/movies.amarpin.com
npm run build -w @movie-server/api
sudo chown -R www:www apps/web/.next/standalone
```

---

## Step 5 — systemd

```bash
sudo cp deploy/aapanel/amarpin-api.service /etc/systemd/system/
sudo cp deploy/aapanel/amarpin-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable amarpin-api amarpin-web
sudo systemctl restart amarpin-api
sudo systemctl restart amarpin-web
```

---

## Step 6 — Samba mount helper (one-time)

Required for **Admin → File manager** library scan without manual SSH mounts:

```bash
cd /www/wwwroot/movies.amarpin.com
sudo bash deploy/aapanel/install-smb-mount-helper.sh
sudo systemctl restart amarpin-api
```

Then add Samba only from the website.

---

## Step 7 — aaPanel Nginx

| Site | Config | Proxy |
|------|--------|-------|
| movies.amarpin.com | `nginx-web.conf` | web → `:3000`, `/api/v1/` → `:4000` |
| movies.api.amarpin.com | `nginx-api.conf` | API → `:4000` |

```bash
nginx -t && nginx -s reload
```

---

## Step 8 — Verify

```bash
curl -sS http://127.0.0.1:4000/api/v1/health
curl -I http://127.0.0.1:3000
curl -sS https://movies.api.amarpin.com/api/v1/health
sudo systemctl is-active amarpin-api amarpin-web
```

Expected health: `{"status":"ok","mongo":"up","redis":"up"}`

---

## Step 9 — First admin & libraries

If MongoDB was reset:

```bash
npm run bootstrap:admin
sudo systemctl restart amarpin-api
```

Then in admin UI:

1. **Admin → System → Settings** — site name, logo, SMTP
2. **Admin → File manager** — add Samba server, browse, add library
3. **Admin → Media libraries** — run scan
4. **Admin → System → License** — activate key (30-day trial otherwise)

---

## Updates (quick)

```bash
cd /www/wwwroot/movies.amarpin.com
# upload or git pull changed files
npm run build -w @movie-server/api && sudo systemctl restart amarpin-api
# web: bash deploy/aapanel/rebuild-web.sh
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Site down | `ss -tlnp \| grep -E '3000\|4000'` |
| API fails | `sudo journalctl -u amarpin-api -n 50` — check `.env` `PORT=4000`, MongoDB URI |
| Web 502 | `sudo journalctl -u amarpin-web -n 50` — rebuild web, check standalone path |
| Samba mount error | Run `install-smb-mount-helper.sh`, restart API |
| Redis down | `sudo systemctl status redis` / install Redis |
| Wrong nginx port | aaPanel must proxy to **3000** / **4000** |
