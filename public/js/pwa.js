
if ("serviceWorker" in navigator) {
    const hadController = navigator.serviceWorker.controller != null

    globalThis.addEventListener("load", async () => {
        try {
            const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" })

            reg.addEventListener("updatefound", () => {
                const sw = reg.installing
                if (!sw) return

                sw.addEventListener("statechange", () => {
                    if (sw.state === "installed" && navigator.serviceWorker.controller) sw.postMessage("skipWaiting")
                })
            })
        } catch (err) {
            console.warn(`Failed registering the service worker: ${err}`)
        }
    })

    let reloading = false
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading || !hadController) return

        reloading = true
        globalThis.location.reload()
    })
}

function setOnlineState() {
    document.body.classList.toggle("offline", !navigator.onLine)
}

globalThis.addEventListener("online", setOnlineState)
globalThis.addEventListener("offline", setOnlineState)
document.addEventListener("DOMContentLoaded", setOnlineState)
