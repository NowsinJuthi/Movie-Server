# CineVault on aaPanel (Ubuntu 24 VPS)

This stack is configured so **aaPanel Nginx** handles `80/443` + SSL, while Docker runs MongoDB, Redis, API, and Web on **localhost only**.

## Files

| File | Purpose |
|------|---------|
| `docker-compose.aapanel.yml` | Production compose (no container Nginx on :80) |
| `deploy/aapanel/.env.aapanel.example` | Env template → copy to `.env` |
| `deploy/aapanel/nginx-site.conf` | Reverse proxy for aaPanel site |
| `deploy/aapanel/deploy.sh` | One-shot build/up helper |

## 1. VPS + aaPanel

1. Install aaPanel on Ubuntu 24.
2. Install **Nginx** + **Docker Manager** (or Docker CE via CLI).
3. Open firewall: `22`, `80`, `443`, aaPanel port. Do **not** expose `3001`/`4001` publicly.

## 2. Upload project

```bash
mkdir -p /www/wwwroot/movies.amarpin.com
# upload/clone repo into /www/wwwroot/movies.amarpin.com
cd /www/wwwroot/movies.amarpin.com
```

## 3. Environment

```bash
cp deploy/aapanel/.env.aapanel.example .env
nano .env
```

Change at least:

- `APP_URL` / `API_URL` / `CORS_ORIGINS` → `https://yourdomain.com`
- `JWT_ACCESS_SECRET`
- `BOOTSTRAP_SUPERADMIN_*`
- `PAYMENT_WEBHOOK_SECRET`

Generate a secret:

```bash
openssl rand -hex 32
```

## 4. Deploy containers

```bash
chmod +x deploy/aapanel/deploy.sh
./deploy/aapanel/deploy.sh
```

Or manually:

```bash
mkdir -p /data/movies.amarpin.com/media/movies /data/movies.amarpin.com/media/tv /data/movies.amarpin.com/smb-mounts
docker compose -f docker-compose.aapanel.yml up -d --build
```

Verify:

```bash
curl -sS http://127.0.0.1:4001/api/v1/health
curl -I http://127.0.0.1:3001
```

## 5. aaPanel website

1. **Website → Add site** → `yourdomain.com`
2. Enable **SSL → Let’s Encrypt** (Force HTTPS)
3. Open site **Config** and merge proxy rules from `deploy/aapanel/nginx-site.conf`:
   - `/api/` → `http://127.0.0.1:4001`
   - `/socket.io/` → `http://127.0.0.1:4001` (WebSocket upgrade)
   - `/` → `http://127.0.0.1:3001`
4. Reload Nginx

## 6. Media libraries

Host folders (default):

- `/data/movies.amarpin.com/media/movies`
- `/data/movies.amarpin.com/media/tv`

Inside the API container these are `/data/media/movies` and `/data/media/tv` (already set in compose).

In Admin → Media libraries you can also add other absolute paths under `/data/media/...`.

## 7. Updates

```bash
cd /www/wwwroot/movies.amarpin.com
git pull   # if using git
./deploy/aapanel/deploy.sh
```

## 8. Useful commands

```bash
docker compose -f docker-compose.aapanel.yml ps
docker compose -f docker-compose.aapanel.yml logs -f api
docker compose -f docker-compose.aapanel.yml restart api web
```

## Notes

- Do **not** run the default `docker-compose.yml` nginx on port 80 while aaPanel Nginx is active.
- Samba: mount shares on the host into `/data/movies.amarpin.com/smb-mounts` (or use Admin Samba file manager with CIFS permissions).
- 8GB RAM is enough for this stack; watch Docker stats under heavy transcode/scan load.
- If API refuses to start because `PAYMENT_PROVIDER=fake` on a public HTTPS URL, set real Stripe keys or temporarily use a non-public test domain until billing is configured.
