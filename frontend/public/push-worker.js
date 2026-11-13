/* Notifications push des alertes (importé par le service worker généré). */
// Dates écrites par le serveur (⟦ISO⟧) : affichées à l'heure de l'appareil (v0.34.0).
function localizeTimes(text) {
  return String(text || "").replace(/⟦([^⟧]+)⟧/g, function (_m, iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var hour = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return d.toDateString() === new Date().toDateString() ? hour : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " " + hour;
  });
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "NJMDev", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "NJMDev", {
      body: localizeTimes(data.body),
      tag: data.tag,
      renotify: Boolean(data.tag),
      icon: "/njmdev-icon-192.png",
      badge: "/njmdev-icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
