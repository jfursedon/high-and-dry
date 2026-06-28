// Offline shell with a network-first strategy: online users always get the
// latest code (no stale-cache-after-deploy trap), and the cached copy is the
// fallback when offline. Weather requests bypass the cache entirely.
const CACHE = "sandstone-v2";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./crags.js",
  "./model.js",
  "./icon.svg",
  "./manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // never touch the weather API or the Windy embed — straight to the network
  if (url.hostname.endsWith("open-meteo.com")) return;
  if (url.hostname.endsWith("windy.com")) return;
  if (e.request.method !== "GET") return;
  // network-first: fresh when online, refresh the cache, fall back when offline
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
