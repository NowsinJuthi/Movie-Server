# AmarPin — Port map (PC + VPS same)

## One port set everywhere

| Service | Port | Local URL | Public URL (VPS) |
|---------|------|-----------|------------------|
| **Web** | **3000** | http://localhost:3000 | https://movies.amarpin.com |
| **API** | **4000** | http://localhost:4000/api/v1 | https://movies.api.amarpin.com/api/v1 |
| **Health** | **4000** | `http://127.0.0.1:4000/api/v1/health` | `https://movies.api.amarpin.com/api/v1/health` |

PC dev and VPS production use the **same ports**. Only the public HTTPS domain (443) differs.

Nginx (80/443) proxies to localhost **3000** (web) and **4000** (API). Do **not** open 3000/4000 in firewall.

---

## `.env` (PC and VPS)

```env
PORT=4000
APP_URL=http://localhost:3000          # VPS: https://movies.amarpin.com
API_URL=http://localhost:4000          # VPS: https://movies.api.amarpin.com
API_INTERNAL_URL=http://127.0.0.1:4000
NEXT_PUBLIC_API_URL=/api/v1            # VPS: https://movies.api.amarpin.com/api/v1
```

---

## Commands

```bash
# Dev (PC)
npm run dev:api   # :4000
npm run dev:web   # :3000

# Health
curl -sS http://127.0.0.1:4000/api/v1/health
curl -I http://127.0.0.1:3000
```

---

## Nginx proxy (aaPanel)

| Site | Path | proxy_pass |
|------|------|------------|
| movies.amarpin.com | `/api/v1/` | `http://127.0.0.1:4000` |
| movies.amarpin.com | `/` | `http://127.0.0.1:3000` |
| movies.api.amarpin.com | `/` | `http://127.0.0.1:4000` |

Config: `deploy/aapanel/nginx-web.conf`, `deploy/aapanel/nginx-api.conf`

---

## systemd (VPS)

Web service sets `PORT=3000`. API reads `PORT=4000` from `.env`.

```bash
sudo cp deploy/aapanel/amarpin-api.service /etc/systemd/system/
sudo cp deploy/aapanel/amarpin-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart amarpin-api amarpin-web
ss -tlnp | grep -E '3000|4000'
```

Full guide: [VPS-SYSTEMD-DEPLOY.md](./VPS-SYSTEMD-DEPLOY.md)
