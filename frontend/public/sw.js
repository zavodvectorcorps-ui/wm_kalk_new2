/* Service Worker for ALICOR SPA Push Notifications */

const CACHE_NAME = 'wm-group-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
});

// Push notification received
self.addEventListener('push', (event) => {
  console.log('Push notification received');
  
  let data = {
    title: 'ALICOR SPA',
    body: 'Новое уведомление',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: {}
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        data: payload.data || {}
      };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [200, 100, 200],
    data: data.data,
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'close', title: 'Закрыть' }
    ],
    requireInteraction: true
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  // Get URL to open
  const data = event.notification.data || {};
  let url = '/driver';
  
  if (data.tripId) {
    url = `/driver?trip=${data.tripId}`;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (let client of windowClients) {
          if (client.url.includes('/driver') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Background sync for offline delivery confirmations
self.addEventListener('sync', (event) => {
  if (event.tag === 'delivery-confirmation') {
    event.waitUntil(syncDeliveryConfirmations());
  }
});

async function syncDeliveryConfirmations() {
  // Get pending confirmations from IndexedDB and sync them
  console.log('Syncing delivery confirmations...');
}
