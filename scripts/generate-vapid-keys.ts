/**
 * Generate a VAPID key pair for Web Push. Run once per deployment; paste the
 * output into your env files. The public key goes to the browser (it is in the
 * bundle), the private key stays server-only.
 *
 * Run:
 *   pnpm tsx scripts/generate-vapid-keys.ts
 *
 * Then set:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public>   (.env.local / .env.prod)
 *   VAPID_PRIVATE_KEY=<private>             (server-only)
 *   VAPID_SUBJECT=mailto:you@example.com    (optional; defaults to a mailto)
 */
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=%s", publicKey);
console.log("VAPID_PRIVATE_KEY=%s", privateKey);
