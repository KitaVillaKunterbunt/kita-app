// Service Worker — Kita-App
// Strategie: Cache First für App-Shell

const CACHE_NAME = 'kita-app-v12';

// Relative Pfade (aufgelöst gegenüber der Service-Worker-URL selbst) statt absoluter
// Pfade ab der Domain-Wurzel, damit die App auch in einem Unterordner funktioniert
// (z.B. https://<username>.github.io/kita-app/ statt an der Domain-Wurzel).
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './src/styles/main.css',
  './src/app.js',
  './src/auth.js',
  './src/data/mock.js',
  './src/data/api.js',
  './src/screens/home.js',
  './src/screens/plan.js',
  './src/screens/antrag.js',
  './src/screens/meine-antraege.js',
  './src/screens/infos.js',
  './src/screens/dashboard.js',
  './src/notifications.js',
];

// Install: App-Shell in Cache legen
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  // Kein skipWaiting() hier — wird von der App-Seite ausgelöst
});

// Nachricht von der App-Seite: sofort übernehmen
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate: Alten Cache löschen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Benachrichtigungs-Klick: richtigen Screen öffnen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const hash = event.notification.data?.hash ?? 'home';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.postMessage({ type: 'NAVIGATE', hash });
          return client.focus();
        }
      }
      return clients.openWindow?.('./#' + hash);
    })
  );
});

// Fetch: Cache First für App-Shell
self.addEventListener('fetch', (event) => {
  // Nur GET-Requests cachen
  if (event.request.method !== 'GET') return;

  // Externe Requests (z.B. Graph API Phase 2) nicht cachen
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // plan-export.json: immer frisch vom Server — nie cachen (endsWith statt exaktem
  // Pfadvergleich, damit das auch im Unterordner funktioniert, z.B. /kita-app/plan-export.json)
  if (url.pathname.endsWith('/plan-export.json')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        // Nur gültige Responses cachen
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // Offline-Fallback: index.html zurückgeben
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
