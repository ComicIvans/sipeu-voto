# syntax=docker/dockerfile:1.7

FROM node:24 AS base
WORKDIR /app

RUN corepack enable \
  && npm cache clean --force

FROM base AS builder

ARG NUXT_SITE_URL

ENV npm_config_nodedir=/usr/local
ENV NUXT_SITE_URL=${NUXT_SITE_URL}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store \
  && pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

RUN pnpm prune --prod --ignore-scripts

RUN mkdir -p /app/data/avatars

FROM gcr.io/distroless/nodejs24-debian12:nonroot AS runner

WORKDIR /app/.output

ENV NODE_ENV=production \
  NITRO_PORT=3000 \
  PORT=3000 \
  HOST=0.0.0.0 \
  APP_DATA_DIR=/app/data \
  PATH="/nodejs/bin:${PATH}"

USER 1000:1000

COPY --from=builder --chown=1000:1000 /app/.output /app/.output
COPY --from=builder --chown=1000:1000 /app/node_modules /app/node_modules
COPY --from=builder --chown=1000:1000 /app/ops/migrate.mjs /app/ops/migrate.mjs
COPY --from=builder --chown=1000:1000 /app/ops/start.mjs /app/ops/start.mjs
COPY --from=builder --chown=1000:1000 /app/drizzle /app/drizzle
COPY --from=builder --chown=1000:1000 /app/data /app/data

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "-e", "const port=process.env.NITRO_PORT||process.env.PORT||'3000';fetch('http://127.0.0.1:'+port+'/health').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["/app/ops/start.mjs"]
