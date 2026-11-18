const CACHE_VERSION = "20261118-1";
const STATIC_CACHE = `deusflow-static-${CACHE_VERSION}`;
const API_CACHE = `deusflow-api-${CACHE_VERSION}`;
const MEDIA_CACHE = `deusflow-media-${CACHE_VERSION}`;
const MAX_MEDIA_ENTRIES = 160;

const STATIC_EXT_RE = /\.(css|js|mjs|svg|png|jpg|jpeg|webp|ico|woff2?|json)(\?.*)?$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  const validCaches = new Set([STATIC_CACHE, API_CACHE, MEDIA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("deusflow-") && !validCaches.has(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
      const excess = keys.length - maxEntries;
      for (let i = 0; i < excess; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (_err) {}
}

async function cacheFirst(request, cacheName, maxEntries = 0) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const networkResponse = await fetch(request);
  if (networkResponse && (networkResponse.ok || networkResponse.type === "opaque")) {
    cache.put(request, networkResponse.clone());
    if (maxEntries > 0) {
      trimCache(cacheName, maxEntries);
    }
  }
  return networkResponse;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const fresh = await networkPromise;
  return fresh || Response.error();
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (_err) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw _err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  // Never intercept admin dashboard or requests originating from /admin/
  const referrer = request.referrer || "";
  if (url.pathname.includes("/admin") || referrer.includes("/admin")) {
    return;
  }

  // Never cache Supabase Auth endpoints
  if (url.hostname.endsWith(".supabase.co") && url.pathname.includes("/auth/")) {
    return;
  }

  // 1. Supabase Storage public photos -> Cache-First (instant repeat views)
  if (
    url.hostname.endsWith(".supabase.co") &&
    (url.pathname.includes("/storage/v1/object/public/") ||
      url.pathname.includes("/storage/v1/render/image/public/"))
  ) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE, MAX_MEDIA_ENTRIES));
    return;
  }

  // 2. Supabase REST public GET queries -> Stale-While-Revalidate
  if (url.hostname.endsWith(".supabase.co") && url.pathname.includes("/rest/v1/")) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // Only handle same-origin pages & static assets beyond this point
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. HTML navigations -> Network-First with cache fallback (keeps deploys fresh, works offline)
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // 4. Static CSS / JS / SVG / Icons -> Stale-While-Revalidate
  if (STATIC_EXT_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});
