# AmarPin — movies.amarpin.com production (aaPanel + systemd)

Production stack used on the live VPS: **Ubuntu + aaPanel + Nginx + systemd + Node.js** (no Docker required).

| URL | Role |
|-----|------|
| `https://movies.amarpin.com` | Next.js web → localhost **3000** |
| `https://movies.api.amarpin.com` | NestJS API → localhost **4000** |

**Project root:** `/www/wwwroot/movies.amarpin.com/`  
**API runs as:** `www` user (systemd)  
**MongoDB:** Atlas (cloud) · **Redis:** local on VPS

PC dev and VPS use the **same ports** (3000 / 4000). aaPanel Nginx owns **80/443** — do not expose 3000/4000 publicly.

→ **Full step-by-step:** [VPS-SYSTEMD-DEPLOY.md](./VPS-SYSTEMD-DEPLOY.md)  
→ **Port map:** [PORTS.md](./PORTS.md)

---

## Architecture

```
Browser (HTTPS :443)
    ↓ aaPanel Nginx
    ├─ movies.amarpin.com  → 127.0.0.1:3000  (amarpin-web)
    └─ movies.api.amarpin.com → 127.0.0.1:4000  (amarpin-api)
                                    ↓
                    MongoDB Atlas (metadata)
                    Redis 127.0.0.1:6379 (sessions, rate limits)
                    storage/ (uploads, HLS temp, Samba mounts)
                    Samba NAS (via CIFS mount)
```

---

## 1. VPS requirements

1. Ubuntu 22/24 with **aaPanel**
2. **Node.js ≥ 20**, **npm**, **FFmpeg**, **Redis**, **cifs-utils**, **smbclient**
3. Firewall: allow `22`, `80`, `443`, aaPanel port. Block public `3000` / `4000`.
4. DNS A records → VPS IP:
   - `movies.amarpin.com`
   - `movies.api.amarpin.com`

---

## 2. Project & storage layout

All on-disk files (except MongoDB text data) live under **`storage/`**:

| Path | Purpose |
|------|---------|
| `storage/uploads/artwork` | Movie/series posters & backdrops |
| `storage/uploads/avatars` | Profile pictures |
| `storage/uploads/branding` | Site logo & favicon |
| `storage/hls-pack` | Streaming transcode temp segments |
| `storage/smb-mounts` | Samba/NAS CIFS mount points |

One-time setup:

```bash
sudo mkdir -p /www/wwwroot/movies.amarpin.com/storage/uploads/{artwork,avatars,branding} \
  /www/wwwroot/movies.amarpin.com/storage/hls-pack \
  /www/wwwroot/movies.amarpin.com/storage/smb-mounts
sudo chown -R www:www /www/wwwroot/movies.amarpin.com/storage
sudo chmod -R 755 /www/wwwroot/movies.amarpin.com/storage
```

---

## 3. Environment (`.env`)

Copy a template and edit:

```bash
cp .env.example .env
# or: cp deploy/aapanel/.env.aapanel.example .env
nano .env
```

### Required variables

| Variable | Example / notes |
|----------|-----------------|
| `PORT` | `4000` |
| `APP_URL` | `https://movies.amarpin.com` |
| `API_URL` | `https://movies.api.amarpin.com` |
| `API_INTERNAL_URL` | `http://127.0.0.1:4000` |
| `NEXT_PUBLIC_API_URL` | `https://movies.api.amarpin.com/api/v1` |
| `MONGODB_URI` | MongoDB Atlas `mongodb+srv://...` |
| `REDIS_HOST` | `127.0.0.1` |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` |
| `LICENSE_MASTER_SECRET` | Separate HMAC secret for license keys |
| `BOOTSTRAP_SUPERADMIN_EMAIL` | First admin email |
| `BOOTSTRAP_SUPERADMIN_PASSWORD` | Strong password |
| `COOKIE_DOMAIN` | `.amarpin.com` |
| `COOKIE_SECURE` | `true` |
| `CORS_ORIGINS` | `https://movies.amarpin.com` |
| `ARTWORK_UPLOAD_DIR` | `.../storage/uploads/artwork` |
| `AVATAR_UPLOAD_DIR` | `.../storage/uploads/avatars` |
| `BRANDING_UPLOAD_DIR` | `.../storage/uploads/branding` |
| `HLS_PACK_DIR` | `.../storage/hls-pack` |
| `SMB_MOUNT_ROOT` | `.../storage/smb-mounts` |
| `SMB_MOUNT_USE_SUDO` | `true` (after helper install) |

Full annotated templates: **`.env.example`** (root) and **`deploy/aapanel/.env.aapanel.example`**.

### MongoDB Atlas

- Whitelist VPS IP in Atlas → Network Access.
- After wiping/recreating the database, re-bootstrap admin:

```bash
cd /www/wwwroot/movies.amarpin.com
npm run bootstrap:admin
sudo systemctl restart amarpin-api
```

---

## 4. Build & systemd

```bash
cd /www/wwwroot/movies.amarpin.com
npm install
npm run build -w @movie-server/shared
npm run build -w @movie-server/api
npm run build -w @movie-server/web

sudo cp deploy/aapanel/amarpin-api.service /etc/systemd/system/
sudo cp deploy/aapanel/amarpin-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable amarpin-api amarpin-web
sudo systemctl restart amarpin-api amarpin-web
```

### Verify

```bash
curl -sS http://127.0.0.1:4000/api/v1/health
curl -I http://127.0.0.1:3000
curl -sS https://movies.api.amarpin.com/api/v1/health
```

Expected: `{"status":"ok","mongo":"up","redis":"up"}`

### Useful commands

```bash
sudo systemctl status amarpin-api amarpin-web
sudo systemctl restart amarpin-api
sudo journalctl -u amarpin-api -n 50 --no-pager
sudo journalctl -u amarpin-web -n 50 --no-pager
ss -tlnp | grep -E '3000|4000'
```

---

## 5. aaPanel Nginx + SSL

Create **two** websites. Enable **Let's Encrypt** (Force HTTPS).

| Site | Config file | Proxy |
|------|-------------|-------|
| `movies.amarpin.com` | `nginx-web.conf` | `/` → `:3000`, `^~ /api/v1/` → `:4000` |
| `movies.api.amarpin.com` | `nginx-api.conf` | `/` → `:4000` |

**Critical:** `location ^~ /api/v1/` must appear **before** `location /` on the web site.

Remove aaPanel `include extension/movies.amarpin.com/*.conf` if it steals API routes (HTML 502 on POST).

```bash
nginx -t && nginx -s reload
```

---

## 6. Samba / SMB (website-only)

| Step | Tool | Notes |
|------|------|-------|
| Add server (test) | `smbclient` | Works as `www` user |
| Browse folders | `smbclient ls` | Admin → File manager |
| Library scan + playback | CIFS mount | Needs root — handled automatically |

### One-time mount helper (required)

API runs as `www` and cannot call `mount.cifs` directly. Install once:

```bash
cd /www/wwwroot/movies.amarpin.com
sudo bash deploy/aapanel/install-smb-mount-helper.sh
sudo systemctl restart amarpin-api
```

This installs `/usr/local/bin/amarpin-mount-smb` and grants `www` passwordless sudo **only** for that script.

After that, add Samba servers and libraries **only in Admin → File manager** — no SSH per share, no manual mount.

### Add Samba server (Admin → File manager)

- **Host:** Samba server IP (e.g. `103.114.38.210`)
- **Port:** `445`
- **Share:** share name (e.g. `Data-Storage`)
- **User / password:** Samba account — not necessarily your PC login
- **Domain:** blank unless domain-joined

### Samba troubleshooting

```bash
# Helper installed?
ls -l /usr/local/bin/amarpin-mount-smb
sudo cat /etc/sudoers.d/amarpin-smb-mount

# API logs after failed mount
sudo journalctl -u amarpin-api -n 80 --no-pager | grep -i smb

# Manual fallback (one share)
chmod +x deploy/aapanel/mount-smb-share.sh
sudo ./deploy/aapanel/mount-smb-share.sh SERVER_ID HOST SHARE USER 'PASSWORD' \
  /www/wwwroot/movies.amarpin.com/storage/smb-mounts
```

---

## 7. Media libraries

Create libraries in **Admin → Media libraries** (local path or Samba). The API does **not** auto-create Movies/TV folders on boot.

Library scan downloads posters to `storage/uploads/artwork/` when `TMDB_API_KEY` is set.

---

## 8. Updates (code deploy)

Upload changed files or `git pull`, then rebuild what changed:

```bash
cd /www/wwwroot/movies.amarpin.com

# API only
npm run build -w @movie-server/api
sudo systemctl restart amarpin-api

# Web only (use helper script)
bash deploy/aapanel/rebuild-web.sh

# Both
npm run build -w @movie-server/shared
npm run build -w @movie-server/api
npm run build -w @movie-server/web
sudo systemctl restart amarpin-api amarpin-web
```

After changing `NEXT_PUBLIC_*`, always rebuild **web**.

If build fails with permission errors:

```bash
sudo rm -rf apps/api/dist apps/web/.next
sudo chown -R sohelonlineit:www /www/wwwroot/movies.amarpin.com
npm run build -w @movie-server/api
sudo chown -R www:www apps/web/.next/standalone
```

---

## 9. Common errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot reach the API server` | Wrong Nginx / CSP / API URL | Check `nginx-web.conf`; `NEXT_PUBLIC_API_URL` |
| `POST /api/v1/*` returns HTML 502 | aaPanel extension steals routes | Remove `include extension/.../*.conf` |
| Samba `permission denied` on mount | Helper not installed | `install-smb-mount-helper.sh` + restart API |
| `raw.trim is not a function` | Old API build | Pull latest `smb-mount.service.ts`, rebuild API |
| Posters missing after path change | `posterKey` in DB but file gone | Library rescan; or copy old artwork to `storage/uploads/artwork` |
| MongoDB empty after reset | Atlas DB recreated | `npm run bootstrap:admin`, re-add libraries & Samba |
| API crash `ECONNREFUSED 6379` | Redis not running | `sudo systemctl start redis` or install Redis |
| `Too many authentication attempts` | Rate limit (production) | Wait 15 min; or dev: `REDIS_HOST=memory` locally |
| Samba upload `HTTP 413` | Nginx body limit (aaPanel default ~50MB) | Set `client_max_body_size 0;` on `movies.amarpin.com` (see `nginx-web.conf`) and reload nginx |
| Samba upload `EACCES permission denied` | CIFS mount owned by root (`uid=0`) | Re-run `install-smb-mount-helper.sh`, `umount` old mounts, browse share to remount as `www` |

---

## 10. File reference

| File | Purpose |
|------|---------|
| `.env.example` | Development / production env template |
| `deploy/aapanel/.env.aapanel.example` | aaPanel production env template |
| `deploy/aapanel/amarpin-api.service` | API systemd unit (`www`, port 4000) |
| `deploy/aapanel/amarpin-web.service` | Web systemd unit (standalone Next.js, port 3000) |
| `deploy/aapanel/install-smb-mount-helper.sh` | One-time Samba sudo helper |
| `deploy/aapanel/amarpin-mount-smb.sh` | Root CIFS mount script (called via sudo) |
| `deploy/aapanel/mount-smb-share.sh` | Manual single-share mount fallback |
| `deploy/aapanel/rebuild-web.sh` | Fast web rebuild on VPS |
| `deploy/aapanel/nginx-web.conf` | Web site + `/api/v1` proxy |
| `deploy/aapanel/nginx-api.conf` | API subdomain |
| `deploy/aapanel/VPS-SYSTEMD-DEPLOY.md` | Short deploy checklist |

---

## Alternate: Docker Compose

If you prefer Docker instead of systemd, see `docker-compose.aapanel.yml` and section 4 of the old Docker flow:

```bash
chmod +x deploy/aapanel/deploy.sh
./deploy/aapanel/deploy.sh
```

Docker API needs `privileged: true` for Samba CIFS mounts. **The live movies.amarpin.com VPS uses systemd, not Docker.**

---

## Stripe webhook (optional)

```text
https://movies.api.amarpin.com/api/v1/billing/webhooks/stripe
```

Do **not** run root `docker-compose.yml` (port 80 nginx) alongside aaPanel on the same VPS.
