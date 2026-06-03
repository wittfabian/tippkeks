// Minimal service worker — exists only to make TippKeks installable and to show
// a friendly offline page. It deliberately caches NOTHING but the static offline
// shell: every request is network-only. RLS-scoped, per-user responses must never
// be cached on the client (shared-device leak + defeats RLS), so we don't.

const CACHE = "tippkeks-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Only failed top-level navigations fall back to the cached offline page;
// everything else is left to the network (and surfaces real errors).
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
