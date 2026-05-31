# syntax=docker/dockerfile:1
#
# Production image for TippKeks (Next.js 16, standalone output).
# Builds with Docker or Podman. Multi-stage: deps → builder → minimal runner.
#
# Build-time vs runtime env:
#  - NEXT_PUBLIC_* are inlined into the CLIENT bundle at build time, so they must
#    be the REAL values and are passed as build args.
#  - Server-only secrets (SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, FOOTBALL_DATA_*)
#    are read at RUNTIME from the container env. A placeholder satisfies the
#    build-time Zod validation in src/lib/env.server.ts; pass the real values to
#    `docker run -e ...` / your compose/quadlet unit.
#  - NEXT_SERVER_ACTIONS_ENCRYPTION_KEY (base64 32 bytes, `openssl rand -base64 32`)
#    is also a RUNTIME env. Next.js reads it on the running server to encrypt/
#    decrypt Server Action arguments. Set it to keep the key stable across
#    rebuilds and across replicas; if unset, Next.js generates a per-build key
#    (fine for a single instance, but it rotates on every rebuild).

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- Dependencies (cached on lockfile changes) ---
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# --- Build ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public (client-inlined) env — real values required for a working image.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
# Server-only secret: placeholder only to pass build-time validation; the real
# key is injected at runtime.
ENV SUPABASE_SERVICE_ROLE_KEY=build-placeholder

RUN pnpm build

# --- Runtime ---
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Standalone server + assets (the only artifacts the runtime needs).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
