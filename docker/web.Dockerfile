FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY tsconfig.base.json ./
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY apps/web/tsconfig.json apps/web/tsconfig.json
RUN npm ci --ignore-scripts

FROM deps AS build
ARG NEXT_PUBLIC_API_URL=https://movies.api.amarpin.com/api/v1
ARG NEXT_PUBLIC_APP_NAME=CineVault
ARG API_INTERNAL_URL=http://api:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV API_INTERNAL_URL=$API_INTERNAL_URL
COPY . .
RUN test -n "$NEXT_PUBLIC_API_URL" || export NEXT_PUBLIC_API_URL=https://movies.api.amarpin.com/api/v1; \
  echo "NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"; \
  npm run build -w @movie-server/shared && npm run build -w @movie-server/web

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
