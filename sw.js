// FitAI Service Worker — handles background notifications
self.addEventListener("install", function(e) {
  self.skipWaiting();
});

self.addEventListener("activate", function(e) {
  e.waitUntil(self.clients.claim());
});

// Receive message from page and show notification
self.addEventListener("message", function(e) {
  if (!e.data || e.data.type !== "SHOW_NOTIFICATION") return;
  e.waitUntil(
    self.registration.showNotification(e.data.title || "FitAI Reminder", {
      body: e.data.body || "",
      icon: e.data.icon || "/assets/icon.png",
      badge: "/assets/icon.png",
      vibrate: [200, 100, 200],
      tag: "fitai-reminder",
      renotify: true,
    })
  );
});

// Handle notification click — focus/open the app
self.addEventListener("notificationclick", function(e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clients) {
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].url.indexOf(self.location.origin) === 0 && "focus" in clients[i]) {
          return clients[i].focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow("/?module=tracking");
    })
  );
});
