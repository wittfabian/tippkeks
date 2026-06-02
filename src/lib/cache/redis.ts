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

/** Create (once) and return the shared client, or null when REDIS_URL is unset. */
function ensureClient(): Redis | null {
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
 * Return the shared client only when it is connected and ready to accept
 * commands; null otherwise. The first call kicks off the (async) connection.
 *
 * Gating on `ready` is what prevents the "Stream isn't writeable" rejection: with
 * `enableOfflineQueue: false`, issuing a command before the connect+AUTH+ready
 * handshake completes (the warmup window after boot) is rejected outright. A
 * connecting or unreachable Valkey therefore reads as "no cache" here, so callers
 * degrade gracefully (cache miss / rate-limit fail-open) instead of logging an
 * error on every pre-ready call.
 */
export function getRedis(): Redis | null {
  const instance = ensureClient();
  return instance?.status === "ready" ? instance : null;
}

/**
 * Like getRedis(), but for correctness-critical writes (cache invalidation) that
 * must not be silently skipped just because the connection is still warming up.
 * Waits up to `timeoutMs` for the client to become ready; resolves null when
 * REDIS_URL is unset or the connection never readies in time (caller degrades).
 */
export function getRedisReady(timeoutMs = 2000): Promise<Redis | null> {
  const instance = ensureClient();
  if (!instance) return Promise.resolve(null);
  if (instance.status === "ready") return Promise.resolve(instance);

  return new Promise((resolve) => {
    const finish = (value: Redis | null) => {
      clearTimeout(timer);
      instance.off("ready", onReady);
      resolve(value);
    };
    const onReady = () => finish(instance);
    const timer = setTimeout(() => finish(null), timeoutMs);
    instance.once("ready", onReady);
  });
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
