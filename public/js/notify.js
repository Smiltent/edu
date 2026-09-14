const STORAGE_KEY = "scheduleNotify"

/** @typedef {{ type: "class" | "teacher" | "classroom", value: string }} NotifySub */
/** @typedef {{ day: string, period: number, from: string, to: string, class: string, teachers?: string[], classroom?: string }} SubjectChange */

function getSubscription() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null

        const sub = JSON.parse(raw)
        if (!sub?.type || !sub?.value) return null
        return /** @type {NotifySub} */ (sub)
    } catch {
        return null
    }
}

/** @param {NotifySub | null} sub */
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

function matchesSubscription(change, sub) {
    if (sub.type === "class") return change.class === sub.value
    if (sub.type === "teacher") return (change.teachers ?? []).includes(sub.value)
    if (sub.type === "classroom") return change.classroom === sub.value
    return false
}

function formatChanges(changes) {
    return changes.map(c => `${c.day} ${c.period} | ${c.from} -> ${c.to}`).join("\n")
}

function showNotification(title, body) {
    if (!("Notification" in window) || Notification.permission !== "granted") return

    try {
        new Notification(title, {
            body,
            icon: "/public/android-chrome-192x192.png"
        })
    } catch (err) {
        console.warn(`Failed to show notification: ${err}`)
    }
}

function handleMessage(msg) {
    const sub = getSubscription()
    if (!sub) return

    const changes = Array.isArray(msg.changes) ? msg.changes : []
    if (!changes.length) return

    // admin test broadcasts to anyone with notifications enabled
    const matched = msg.type === "test"
        ? changes
        : changes.filter(c => matchesSubscription(c, sub))

    if (!matched.length) return

    showNotification(sub.value, formatChanges(matched))
}

let socket = null
let reconnectTimer = null

function connectWS() {
    if (!getSubscription()) return
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return

    const proto = location.protocol === "https:" ? "wss:" : "ws:"
    socket = new WebSocket(`${proto}//${location.host}/v1/ws`)

    socket.addEventListener("message", (event) => {
        try {
            handleMessage(JSON.parse(event.data))
        } catch (err) {
            console.warn(`Bad WS notification payload: ${err}`)
        }
    })

    socket.addEventListener("close", () => {
        socket = null
        if (!getSubscription()) return

        clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(connectWS, 3000)
    })

    socket.addEventListener("error", () => socket?.close())
}

function disconnectWS() {
    clearTimeout(reconnectTimer)
    reconnectTimer = null

    if (socket) {
        socket.close()
        socket = null
    }
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
        setSubscription(null)
        disconnectWS()
        updateButton()
        return
    }

    if (!("Notification" in window)) {
        console.warn("Notifications are not supported in this browser")
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

    setSubscription({ type, value: select.value })
    connectWS()
    updateButton()
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
if (getSubscription()) connectWS()
