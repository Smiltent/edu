const statusEl = document.getElementById("notifyStatus")
const pushSubsEl = document.getElementById("pushSubs")

function setStatus(text, ok = true) {
    if (!statusEl) return
    statusEl.textContent = text
    statusEl.className = ok ? "c-yellow" : "c-orange"
}

/**
 * @param {HTMLFormElement} form
 */
function wireNotifyForm(form) {
    if (!form) return

    form.addEventListener("submit", async (e) => {
        e.preventDefault()

        const res = await fetch(form.action, {
            method: "POST",
            body: new FormData(form),
            headers: { Accept: "application/json" }
        })

        if (!res.ok) {
            setStatus(`failed to send (${res.status})`, false)
            return
        }

        const data = await res.json()
        if (pushSubsEl && data.pushSubs != null) pushSubsEl.textContent = String(data.pushSubs)
        setStatus(`push reached ${data.sent} subscription(s)`, data.sent > 0)
    })
}

wireNotifyForm(document.getElementById("testNotifyForm"))
wireNotifyForm(document.getElementById("specificNotifyForm"))
