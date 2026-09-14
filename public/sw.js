
self.addEventListener("push", (event) => {
    let data = { title: "schedule", body: "", url: "/" }

    try {
        if (event.data) data = Object.assign(data, event.data.json())
    } catch (_) {
        try {
            data.body = event.data ? event.data.text() : ""
        } catch (_) { /* ignore */ }
    }

    event.waitUntil(
        self.registration.showNotification(data.title || "schedule", {
            body: data.body || "",
            icon: "/public/android-chrome-192x192.png",
            badge: "/public/android-chrome-192x192.png",
            data: { url: data.url || "/" }
        })
    )
})

self.addEventListener("notificationclick", (event) => {
    event.notification.close()

    const url = (event.notification.data && event.notification.data.url) || "/"

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && "focus" in client) {
                    return client.focus().then((c) => {
                        if (c && "navigate" in c) return c.navigate(url)
                    })
                }
            }
            if (clients.openWindow) return clients.openWindow(url)
        })
    )
})
