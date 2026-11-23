const CACHE = "mob-shell-v18";
const FILES = [
  "./", "./index.html", "./style.css", "./app.js", "./core.js",
  "./usage-rules.js", "./flow-controls.js", "./focus-audio.js", "./themed-controls.js", "./mob-platform.js", "./flow.js", "./settings-queue.js", "./supabase.js", "./supabase-config.js", "./focus-lake.jpg", "./focus-coast.jpg",
  "./theme-init.js", "./loading.js", "./privacy.html", "./terms.html", "./metiq-credits.html",
  "./icon.svg", "./icon-192.png", "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith("mob-shell-") && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.headers.has("range") || new URL(request.url).pathname.endsWith(".mp4")) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok && FILES.some(file => new URL(file, self.registration.scope).href === request.url)) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const fallback = await cache.match(request);
      if (fallback) return fallback;
      if (request.mode === "navigate") return (await cache.match("./index.html")) ?? Response.error();
      return Response.error();
    }
  })());
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const window = windows.find(client => client.url.startsWith(self.registration.scope));
    if (window) await window.focus();
    else await self.clients.openWindow("./");
  })());
});
