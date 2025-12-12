/**
 * Service Worker pour WhatDidIMine
 * Gère les notifications push et le cache hors ligne
 */

const CACHE_NAME = 'whatdidimine-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/index.css',
  '/assets/index.js'
];

/**
 * Installation du Service Worker
 * Met en cache les ressources essentielles
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Mise en cache des ressources');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[SW] Erreur lors de la mise en cache:', error);
      })
  );

  // Prendre le contrôle immédiatement
  self.skipWaiting();
});

/**
 * Activation du Service Worker
 * Nettoie les anciens caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Suppression de l\'ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Prendre le contrôle de tous les clients
  return self.clients.claim();
});

/**
 * Interception des requêtes réseau
 * Stratégie: Network First, fallback sur Cache
 */
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Ignorer les requêtes vers l'API (toujours récupérer du réseau)
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cloner la réponse car elle ne peut être utilisée qu'une fois
        const responseToCache = response.clone();

        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // Si le réseau échoue, essayer le cache
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            // Retourner une page offline par défaut
            return new Response('Offline - Pas de connexion', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

/**
 * Gestion des notifications push
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Notification push reçue');

  let data = {
    title: 'WhatDidIMine',
    body: 'Nouvelle notification',
    icon: '/icon.png',
    badge: '/badge.png',
    tag: 'whatdidimine-notification'
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-72.png',
    tag: data.tag || 'whatdidimine-notification',
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/**
 * Gestion des clics sur les notifications
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Clic sur notification');

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si l'application est déjà ouverte, la focus
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Sinon, ouvrir une nouvelle fenêtre
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

/**
 * Gestion de la synchronisation en arrière-plan
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Synchronisation en arrière-plan:', event.tag);

  if (event.tag === 'sync-mining-data') {
    event.waitUntil(
      // Synchroniser les données de minage
      syncMiningData()
    );
  }
});

/**
 * Fonction pour synchroniser les données de minage
 */
async function syncMiningData() {
  try {
    // Récupérer les données depuis l'API
    const response = await fetch('/api/mining/sync', {
      method: 'POST',
      credentials: 'include'
    });

    if (response.ok) {
      console.log('[SW] Synchronisation réussie');
      // Notifier l'utilisateur
      await self.registration.showNotification('Synchronisation terminée', {
        body: 'Vos données de minage ont été mises à jour',
        icon: '/icon-192.png',
        tag: 'sync-complete'
      });
    }
  } catch (error) {
    console.error('[SW] Erreur de synchronisation:', error);
  }
}

/**
 * Gestion des messages depuis l'application
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message reçu:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(event.data.payload))
    );
  }
});
