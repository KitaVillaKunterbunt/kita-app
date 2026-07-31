// Service Worker — Kita-App
// Strategie: Network First für App-Shell
// → Immer neueste Version vom Netzwerk; Cache nur als Offline-Fallback.

const CACHE_NAME = 'kita-app-v18';

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

// Install: App-Shell in Cache legen (Offline-Basis)
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

// Fetch: Network First — immer Netzwerk versuchen, Cache nur als Offline-Fallback
self.addEventListener('fetch', (event) => {
  // Nur GET-Requests behandeln
  if (event.request.method !== 'GET') return;

  // Externe Requests (z.B. Graph API) nicht anfassen
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // plan-export.json: komplett dem Browser überlassen (kein SW-Eingriff)
  if (url.pathname.endsWith('/plan-export.json')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Nur gültige Responses in den Cache schreiben (aktualisiert den Offline-Stand)
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Kein Netzwerk → Cache-Fallback
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Navigations-Fallback: index.html ausliefern
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
