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

// Web Push: render the notification sent by the server dispatcher. The payload
// is JSON ({ title, body, url, tag }); we never put another player's tip in it
// (the server only sends the recipient's own reminder/result), so showing it is
// safe. `userVisibleOnly` subscriptions require a visible notification per push.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = payload.title || "TippKeks";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag,
      data: { url: payload.url || "/" },
    }),
  );
});

// Tapping a notification focuses an existing app window on the target URL, or
// opens a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
