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
#    overridden at runtime). It is a genuine secret, so it is passed as a BuildKit
#    SECRET (`--mount=type=secret`, not ARG/ENV — which would persist it in image
#    layers/history). If unset, next build generates a random per-build key that
#    rotates on every rebuild. Pass the SAME value at runtime too: the Node server
#    reads it at runtime and it must match across all replicas (otherwise "Failed
#    to find Server Action" after a rebuild/rollout).

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
# Optional: the Web Push public VAPID key. Omit to build an image without push
# (the toggle hides itself and the dispatcher no-ops).
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
# (No SUPABASE_SERVICE_ROLE_KEY here: the build never needs it — it is asserted
# at runtime in createServiceClient. Inject the real key into the running container.)

# Server Actions encryption key — consumed by `next build` and embedded into the
# build output (and any Edge bundle, where runtime can't override it). Passed as a
# BuildKit secret (not ARG/ENV) so the value never lands in image layers/history;
# it is exported into the env only for the lifetime of this one RUN. Empty/absent
# (e.g. a plain `docker build` with no --secret) ⇒ Next generates a random per-build
# key that rotates each rebuild. Provide the SAME value at runtime (see header).
RUN --mount=type=secret,id=next_server_actions_encryption_key \
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/next_server_actions_encryption_key 2>/dev/null || true)" \
    pnpm build

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

# Liveness probe against the dedicated /api/health endpoint (200 = up). The
# runtime image has no curl/wget, so use Node's global fetch; a non-2xx response
# or a connection error fails the check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
