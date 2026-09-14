const STORAGE_KEY = "scheduleNotify"

function getSubscription() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null

        const sub = JSON.parse(raw)
        if (!sub?.type || !sub?.value) return null
        return sub
    } catch {
        return null
    }
}

function setSubscription(sub) {
    if (!sub) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(sub))
}

function getPageType() {
    const path = location.pathname.replace(/\/+$/, "") || "/"
    if (path.endsWith("/class")) return "class"
    if (path.endsWith("/teacher")) return "teacher"
    if (path.endsWith("/classroom")) return "classroom"
    return null
}

function getMainSelect() {
    return document.querySelector("#selectClass, #selectTeacher, #selectClassroom")
}

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const raw = atob(base64)
    const output = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
    return output
}

async function ensureServiceWorker() {
    if (!("serviceWorker" in navigator)) throw new Error("service workers unsupported")
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
    await navigator.serviceWorker.ready
    return reg
}

async function subscribePush(filterType, filterValue) {
    const keyRes = await fetch("/v2/push/vapidPublicKey").then(r => r.json())
    if (!keyRes.success || !keyRes.publicKey) throw new Error(keyRes.error || "no vapid key")

    const reg = await ensureServiceWorker()

    let pushSub = await reg.pushManager.getSubscription()
    if (!pushSub) {
        pushSub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(keyRes.publicKey)
        })
    }

    const body = {
        subscription: pushSub.toJSON(),
        filterType,
        filterValue
    }

    const res = await fetch("/v2/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    })

    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data.error || "subscribe failed")
}

async function unsubscribePush() {
    if (!("serviceWorker" in navigator)) return

    const reg = await navigator.serviceWorker.getRegistration()
    const pushSub = await reg?.pushManager.getSubscription()
    if (!pushSub) return

    const endpoint = pushSub.endpoint

    try {
        await pushSub.unsubscribe()
    } catch (err) {
        console.warn(`Push unsubscribe failed: ${err}`)
    }

    await fetch("/v2/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint })
    }).catch(() => {})
}

function isActiveForCurrent() {
    const type = getPageType()
    const select = getMainSelect()
    const sub = getSubscription()
    if (!type || !select || !sub) return false
    return sub.type === type && sub.value === select.value
}

function updateButton() {
    const btn = document.getElementById("notifyBtn")
    if (!btn) return

    const active = isActiveForCurrent()
    btn.classList.toggle("active", active)
    btn.classList.toggle("connected", active)
    btn.setAttribute("aria-pressed", active ? "true" : "false")

    btn.title = active
        ? (window.t?.("notify.disable") ?? "disable notifications")
        : (window.t?.("notify.enable") ?? "enable notifications")
}

async function toggleNotifications() {
    const type = getPageType()
    const select = getMainSelect()
    if (!type || !select?.value) return

    if (isActiveForCurrent()) {
        await unsubscribePush()
        setSubscription(null)
        updateButton()
        return
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.warn("Push notifications are not supported in this browser")
        return
    }

    let permission = Notification.permission
    if (permission === "default") {
        permission = await Notification.requestPermission()
    }

    if (permission !== "granted") {
        console.warn("Notification permission was not granted")
        return
    }

    try {
        await subscribePush(type, select.value)
        setSubscription({ type, value: select.value })
        updateButton()
    } catch (err) {
        console.warn(`Failed to enable push notifications: ${err}`)
    }
}

function setupButton() {
    const btn = document.getElementById("notifyBtn")
    if (!btn) return

    btn.addEventListener("click", () => toggleNotifications())

    const select = getMainSelect()
    select?.addEventListener("change", updateButton)

    if (select) {
        const observer = new MutationObserver(updateButton)
        observer.observe(select, { childList: true })
    }

    updateButton()
}

setupButton()

// re-sync push subscription if preference was already saved
const existing = getSubscription()
if (existing && "serviceWorker" in navigator && "PushManager" in window) {
    subscribePush(existing.type, existing.value).catch(err => {
        console.warn(`Failed to restore push subscription: ${err}`)
    })
}
