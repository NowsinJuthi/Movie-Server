# AmarPin Web (`@movie-server/web`)

Next.js application for **[movies.amarpin.com](https://movies.amarpin.com)**: the public streaming UI (profiles, home, watch, subscribe, account) and the **Admin** panel at `/admin`.

This app is part of the **Movie-Server** monorepo. Setup, environment variables, production deploy, and API pairing are documented in the **[root README](../../README.md)**.

## Development

From the repository root:

```bash
npm install
npm run build -w @movie-server/shared
npm run dev:web
```

Open http://localhost:3000. The web app expects the API at http://localhost:4000 (`NEXT_PUBLIC_API_URL` in `.env`).

## Production build

```bash
npm run build -w @movie-server/web
npm run start:web
```

On the live VPS, use `bash deploy/aapanel/rebuild-web.sh` after deploying web source changes.

## Structure (high level)

| Path | Purpose |
|------|---------|
| `src/app/home/` | Authenticated viewer experience |
| `src/app/admin/` | Staff admin routes |
| `src/app/login`, `register`, `subscribe` | Auth and billing entry points |
| `src/components/` | Shared UI, player, layout, admin widgets |

Shared types come from `@movie-server/shared` (build the shared package before building web).
