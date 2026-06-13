# syntax=docker/dockerfile:1

# --- Base: Node + pnpm via corepack ---
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# --- Full dependencies (for building) ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# --- Production-only dependencies (for the migration runner) ---
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts

# --- Build the Nuxt/Nitro app ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- Runtime ---
FROM base AS runner
ENV NODE_ENV=production
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0

COPY --from=build /app/.output ./.output
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/server/db/migrations ./server/db/migrations
COPY server/db/migrate.mjs ./server/db/migrate.mjs
COPY package.json ./

EXPOSE 3000

# /branded-public may be bind-mounted by the host with per-deployment assets
# (favicon.png, apple-touch-icon.png, images/toastmasters-logo.png) that are
# gitignored because they contain trademarked Toastmasters branding.
CMD ["sh", "-c", "cp -rT /branded-public/ .output/public/ 2>/dev/null || true && node server/db/migrate.mjs && node .output/server/index.mjs"]
