const VERSION = "%VERSION%"

const SHELL = `shell-${VERSION}`
const DATA = `data-${VERSION}`
const VENDOR = `vendor-${VERSION}`

const SHELL_URLS = [
    "/",
    "/class",
    "/teacher",
    "/classroom",
    "/times",
    "/site.webmanifest",
    "/public/style.css",
    "/public/js/lookup.js",
    "/public/js/search.js",
    "/public/js/download.js",
    "/public/js/times.js",
    "/public/js/pwa.js",
    "/public/favicon.ico",
    "/public/favicon-16x16.png",
    "/public/favicon-32x32.png",
    "/public/apple-touch-icon.png",
    "/public/android-chrome-192x192.png",
    "/public/android-chrome-512x512.png"
]

// pages that depend on session state or mutate it, never worth serving from a cache
const NEVER_CACHE = ["/login", "/logout", "/register", "/admin", "/v1/ws", "/v2/admin"]

const VENDOR_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"]

const NETWORK_TIMEOUT = 4000

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL)

        // one bad url would reject the whole addAll, so they are cached individually
        await Promise.all(SHELL_URLS.map(url =>
            cache.add(new Request(url, { cache: "reload" })).catch(() => {})
        ))

        await self.skipWaiting()
    })())
})

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const keep = [SHELL, DATA, VENDOR]
        const names = await caches.keys()

        await Promise.all(names.map(n => keep.includes(n) ? null : caches.delete(n)))
        await self.clients.claim()
    })())
})

self.addEventListener("message", (event) => {
    if (event.data === "skipWaiting") self.skipWaiting()
})

self.addEventListener("fetch", (event) => {
    const req = event.request
    if (req.method !== "GET") return

    const url = new URL(req.url)

    if (url.origin !== self.location.origin) {
        if (VENDOR_HOSTS.includes(url.hostname)) event.respondWith(staleWhileRevalidate(req, VENDOR))
        return
    }

    if (NEVER_CACHE.some(p => url.pathname === p || url.pathname.startsWith(`${p}/`))) return

    if (req.mode === "navigate") return event.respondWith(navigation(req))
    if (url.pathname.startsWith("/v2/")) return event.respondWith(networkFirst(req, DATA))

    event.respondWith(staleWhileRevalidate(req, SHELL))
})

async function navigation(req) {
    const cache = await caches.open(SHELL)

    try {
        const res = await withTimeout(fetch(req), NETWORK_TIMEOUT)
        if (res.ok) cache.put(req, res.clone())

        return res
    } catch {
        // an unvisited page while offline still gets the app instead of the browser error
        return await cache.match(req) ?? await cache.match("/") ?? Response.error()
    }
}

async function networkFirst(req, name) {
    const cache = await caches.open(name)

    try {
        const res = await withTimeout(fetch(req), NETWORK_TIMEOUT)
        if (res.ok) cache.put(req, res.clone())

        return res
    } catch {
        const cached = await cache.match(req)
        if (cached) return cached

        // the pages only look at success, so this reads the same as a failed fetch
        return new Response(JSON.stringify({ success: false, offline: true }), {
            status: 503,
            headers: { "Content-Type": "application/json" }
        })
    }
}

async function staleWhileRevalidate(req, name) {
    const cache = await caches.open(name)
    const cached = await cache.match(req)

    const update = fetch(req)
        .then(res => {
            if (cacheable(res)) cache.put(req, res.clone())
            return res
        })
        .catch(() => null)

    if (cached) return cached

    return await update ?? Response.error()
}

// fonts and the html2canvas script are cross origin scripts, so they come back opaque
function cacheable(res) {
    return res.ok || res.type === "opaque"
}

function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), ms)

        promise.then(resolve, reject).finally(() => clearTimeout(timer))
    })
}
