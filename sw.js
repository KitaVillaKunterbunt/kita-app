self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', async () => {
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  await self.registration.unregister();
  self.clients.claim();
});
self.addEventListener('fetch', e => e.respondWith(fetch(e.request)));
