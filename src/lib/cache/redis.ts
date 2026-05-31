import "server-only";
import Redis from "ioredis";

import { serverEnv } from "@/lib/env.server";

/**
 * Lazily-created Valkey/Redis client, shared across the server process. Returns
 * null when REDIS_URL is unset so callers degrade gracefully (no cache, no rate
 * limiting) instead of crashing. A connection error is logged but never thrown
 * here — command-level callers catch and fall back, so a cache outage can never
 * take down a request.
 */
let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;

  const url = serverEnv.REDIS_URL;
  if (!url) {
    client = null;
    return null;
  }

  const instance = new Redis(url, {
    // Fail fast instead of queueing: a cache/limiter call should never block a
    // request waiting on a dead Valkey. Callers treat rejections as a miss.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  instance.on("error", (err: Error) => {
    console.error("[redis] connection error:", err.message);
  });

  client = instance;
  return client;
}

/**
 * Close the shared connection. Call this at the end of short-lived CLI
 * processes (e.g. `pnpm sync`) so an open socket does not keep Node alive. No-op
 * for the long-running server, which reuses the client.
 */
export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => client?.disconnect());
    client = undefined;
  }
}
