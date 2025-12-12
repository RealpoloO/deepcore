/**
 * @fileoverview Utilitaires pour enregistrer et gérer le Service Worker
 * Gère l'installation, les mises à jour et les notifications
 */

/**
 * Configuration du Service Worker
 */
const swConfig = {
  onSuccess: null,
  onUpdate: null,
  onError: null
};

/**
 * Vérifie si le navigateur supporte les Service Workers
 * @returns {boolean} True si supporté
 */
export function isServiceWorkerSupported() {
  return 'serviceWorker' in navigator;
}

/**
 * Vérifie si les notifications push sont supportées
 * @returns {boolean} True si supporté
 */
export function isPushNotificationSupported() {
  return 'PushManager' in window && 'Notification' in window;
}

/**
 * Enregistre le Service Worker
 * @param {Object} config - Configuration avec callbacks onSuccess, onUpdate, onError
 * @returns {Promise<ServiceWorkerRegistration|null>}
 *
 * @example
 * register({
 *   onSuccess: (registration) => console.log('SW enregistré'),
 *   onUpdate: (registration) => console.log('Nouvelle version disponible'),
 *   onError: (error) => console.error('Erreur SW:', error)
 * });
 */
export async function register(config = {}) {
  if (!isServiceWorkerSupported()) {
    console.log('[SW] Service Workers non supportés');
    return null;
  }

  // Sauvegarder la configuration
  Object.assign(swConfig, config);

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('[SW] Enregistré avec succès:', registration.scope);

    // Gérer les mises à jour
    registration.onupdatefound = () => {
      const installingWorker = registration.installing;

      if (installingWorker == null) {
        return;
      }

      installingWorker.onstatechange = () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // Nouveau contenu disponible
            console.log('[SW] Nouveau contenu disponible, actualisation recommandée');

            if (swConfig.onUpdate) {
              swConfig.onUpdate(registration);
            }
          } else {
            // Contenu mis en cache pour la première fois
            console.log('[SW] Contenu mis en cache pour utilisation hors ligne');

            if (swConfig.onSuccess) {
              swConfig.onSuccess(registration);
            }
          }
        }
      };
    };

    return registration;

  } catch (error) {
    console.error('[SW] Erreur d\'enregistrement:', error);

    if (swConfig.onError) {
      swConfig.onError(error);
    }

    return null;
  }
}

/**
 * Désenregistre le Service Worker
 * @returns {Promise<boolean>} True si désenregistré avec succès
 */
export async function unregister() {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const result = await registration.unregister();
    console.log('[SW] Désenregistré:', result);
    return result;
  } catch (error) {
    console.error('[SW] Erreur de désenregistrement:', error);
    return false;
  }
}

/**
 * Demande la permission pour les notifications
 * @returns {Promise<NotificationPermission>} 'granted', 'denied' ou 'default'
 *
 * @example
 * const permission = await requestNotificationPermission();
 * if (permission === 'granted') {
 *   console.log('Notifications autorisées');
 * }
 */
export async function requestNotificationPermission() {
  if (!isPushNotificationSupported()) {
    console.log('[Notifications] Non supportées');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    console.log('[Notifications] Permission:', permission);
    return permission;
  }

  return Notification.permission;
}

/**
 * Affiche une notification locale (sans Push API)
 * @param {string} title - Titre de la notification
 * @param {Object} options - Options de notification
 * @returns {Promise<Notification|null>}
 *
 * @example
 * showNotification('Job Terminé', {
 *   body: 'Votre job de manufacturing est terminé',
 *   icon: '/icon.png',
 *   tag: 'job-complete'
 * });
 */
export async function showNotification(title, options = {}) {
  const permission = await requestNotificationPermission();

  if (permission !== 'granted') {
    console.log('[Notifications] Permission refusée');
    return null;
  }

  try {
    if (isServiceWorkerSupported()) {
      // Utiliser le Service Worker pour afficher la notification
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        vibrate: [200, 100, 200],
        ...options
      });
      return null;
    } else {
      // Fallback: notification directe
      return new Notification(title, {
        icon: '/icon-192.png',
        ...options
      });
    }
  } catch (error) {
    console.error('[Notifications] Erreur:', error);
    return null;
  }
}

/**
 * Subscribe aux notifications push (nécessite un serveur VAPID)
 * @param {string} vapidPublicKey - Clé publique VAPID du serveur
 * @returns {Promise<PushSubscription|null>}
 */
export async function subscribeToPush(vapidPublicKey) {
  if (!isPushNotificationSupported()) {
    console.log('[Push] Non supporté');
    return null;
  }

  const permission = await requestNotificationPermission();

  if (permission !== 'granted') {
    console.log('[Push] Permission refusée');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Vérifier si déjà souscrit
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Créer une nouvelle souscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      console.log('[Push] Souscription créée:', subscription);
    }

    return subscription;

  } catch (error) {
    console.error('[Push] Erreur de souscription:', error);
    return null;
  }
}

/**
 * Se désabonner des notifications push
 * @returns {Promise<boolean>} True si désabonné avec succès
 */
export async function unsubscribeFromPush() {
  if (!isPushNotificationSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const result = await subscription.unsubscribe();
      console.log('[Push] Désabonné:', result);
      return result;
    }

    return false;
  } catch (error) {
    console.error('[Push] Erreur de désabonnement:', error);
    return false;
  }
}

/**
 * Convertit une clé VAPID base64 en Uint8Array
 * @param {string} base64String - Clé VAPID en base64
 * @returns {Uint8Array}
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Demande une synchronisation en arrière-plan
 * @param {string} tag - Tag unique pour la synchronisation
 * @returns {Promise<void>}
 *
 * @example
 * requestBackgroundSync('sync-mining-data');
 */
export async function requestBackgroundSync(tag) {
  if (!isServiceWorkerSupported() || !('sync' in registration)) {
    console.log('[Sync] Synchronisation en arrière-plan non supportée');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register(tag);
    console.log('[Sync] Synchronisation demandée:', tag);
  } catch (error) {
    console.error('[Sync] Erreur:', error);
  }
}

export default {
  register,
  unregister,
  isServiceWorkerSupported,
  isPushNotificationSupported,
  requestNotificationPermission,
  showNotification,
  subscribeToPush,
  unsubscribeFromPush,
  requestBackgroundSync
};
