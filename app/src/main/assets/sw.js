const CACHE = 'sun-shell-v0.1.1';
const ASSETS = ['./', './index.html','./styles.css','./app.js','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(fetch(req).then(res => { if (res.ok) {const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy));} return res; }).catch(() => caches.match(req)));
});
