/**
 * Service Worker: Matriz de Auditoría PWA
 * Estrategia de caché para funcionamiento offline y rendimiento óptimo.
 */

const CACHE_NAME = 'auditoria-pwa-v3';

const STATIC_ASSETS = [
  /*
  './',
  './index.html',
  './manifest.json',
  './assets/css/styles.css',
  './assets/css/base/variables.css',
  './assets/css/base/base.css',
  './assets/css/components/header.css',
  './assets/css/components/buttons.css',
  './assets/css/components/forms.css',
  './assets/css/components/kpi.css',
  './assets/css/components/table.css',
  './assets/css/components/filters.css',
  './assets/css/components/notifications.css',
  './assets/css/components/decomp-tree.css',
  './assets/css/pages/auth.css',
  './assets/css/layout/responsive.css',
  './assets/icons/favicon.png',
  './assets/icons/favicon.svg',
  './assets/icons/apple-touch-icon.svg',
  './assets/icons/pwa-icon.svg',
  './assets/icons/icon-maskable.svg',
  './src/main.js',
  './src/domain/models/Record.js',
  './src/domain/ports/AuthPort.js',
  './src/domain/ports/OperationsPort.js',
  './src/domain/ports/ExporterPort.js',
  './src/domain/services/KpiCalculator.js',
  './src/domain/services/FilterService.js',
  './src/application/use-cases/LoginUseCase.js',
  './src/application/use-cases/LogoutUseCase.js',
  './src/application/use-cases/CheckSessionUseCase.js',
  './src/application/use-cases/QueryOperationsUseCase.js',
  './src/application/use-cases/ExportCsvUseCase.js',
  './src/infrastructure/config/supabase.js',
  './src/infrastructure/adapters/SupabaseAuthAdapter.js',
  './src/infrastructure/adapters/SupabaseOperationsAdapter.js',
  './src/infrastructure/adapters/BrowserCsvExporterAdapter.js',
  './src/presentation/state/Store.js',
  './src/presentation/components/Notification.js',
  './src/presentation/components/KpiView.js',
  './src/presentation/components/FilterPanel.js',
  './src/presentation/components/TableView.js',
  './src/presentation/components/ScopeView.js',
  './src/presentation/components/DecompositionTreeView.js',
  './src/presentation/components/GeometricParticles.js',
  './src/presentation/controllers/AppController.js'
  */
];

// Instalación: Precarga de recursos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activación: Limpieza de versiones previas de caché
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network First para APIs de Supabase y Stale-While-Revalidate para estáticos
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Excluir llamadas API / Supabase de la caché estática (siempre red primero)
  if (url.origin.includes('supabase.co') || event.request.method !== 'GET') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Recursos estáticos locales y CDN: Cache First con fallback a red
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Revalidar en segundo plano
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => { });
        return cachedResponse;
      }

      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
