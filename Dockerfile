# syntax=docker/dockerfile:1
#
# Production image for TippKeks (Next.js 16, standalone output).
# Builds with Docker or Podman. Multi-stage: deps → builder → minimal runner.
#
# Build-time vs runtime env:
#  - NEXT_PUBLIC_* are inlined into the CLIENT bundle at build time, so they must
#    be the REAL values and are passed as build args.
#  - Server-only secrets (SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, FOOTBALL_DATA_*)
#    are read at RUNTIME from the container env and are NOT needed by the build
#    (env.server.ts validates them lazily; each is asserted at its point of use).
#    So none are passed as build args — pass the real values to `docker run -e ...`
#    / your compose/quadlet unit instead.
#  - NEXT_SERVER_ACTIONS_ENCRYPTION_KEY (base64 32 bytes, `openssl rand -base64 32`)
#    encrypts Server Action arguments. `next build` consumes it and EMBEDS it into
#    the build output (and compiles it into any Edge bundle, where it can NOT be
#    overridden at runtime), so it is a BUILD ARG. If unset, next build generates a
#    random per-build key that rotates on every rebuild. Pass the SAME value at
#    runtime too: the Node server reads it at runtime and it must match across all
#    replicas (otherwise "Failed to find Server Action" after a rebuild/rollout).

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
# (No SUPABASE_SERVICE_ROLE_KEY here: the build never needs it — it is asserted
# at runtime in createServiceClient. Inject the real key into the running container.)
# Server Actions encryption key — embedded into the build output here. Provide a
# stable value (and the SAME value at runtime); empty ⇒ Next generates a random
# per-build key.
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY

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
