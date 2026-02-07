/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging Service Worker
 *
 * Handles background push notifications when the app is not in the foreground.
 * Uses the Firebase compat SDK since ES modules are not supported in service
 * worker importScripts().
 *
 * IMPORTANT: Update the firebaseConfig below to match your project's values
 * from the Firebase Console (Project Settings > General > Your apps).
 */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// ---------------------------------------------------------------------------
// Firebase config — must match src/lib/firebase.ts values
// ---------------------------------------------------------------------------
firebase.initializeApp({
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
  measurementId: 'YOUR_MEASUREMENT_ID',
});

const messaging = firebase.messaging();

// ---------------------------------------------------------------------------
// Handle background messages (app not in foreground)
// ---------------------------------------------------------------------------
messaging.onBackgroundMessage(function (payload) {
  console.log('[firebase-messaging-sw] Background message received:', payload);

  var notificationTitle = payload.notification?.title || 'StructureWorks Field';
  var notificationOptions = {
    body: payload.notification?.body || 'You have a new message.',
    icon: '/pwa-192x192.svg',
    badge: '/pwa-192x192.svg',
    tag: payload.data?.channelId || 'general',
    data: {
      channelId: payload.data?.channelId || '',
      url: payload.data?.url || '/',
    },
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ---------------------------------------------------------------------------
// Handle notification click — open the app at the right channel
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', function (event) {
  console.log('[firebase-messaging-sw] Notification click:', event.notification.tag);

  event.notification.close();

  var targetUrl = event.notification.data?.url || '/messages';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // If a window is already open, focus it and navigate
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          client.focus();
          if (client.url !== targetUrl && 'navigate' in client) {
            return client.navigate(targetUrl);
          }
          return client;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
