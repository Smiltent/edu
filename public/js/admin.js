const statusEl = document.getElementById("notifyStatus")
const pushSubsEl = document.getElementById("pushSubs")
const remapStatusEl = document.getElementById("remapStatus")
const remapListEl = document.getElementById("remapList")
const REMAP_URL = `${window.location.origin}/v2/admin/subjectRemaps`

function setStatus(text, ok = true) {
    if (!statusEl) return
    statusEl.textContent = text
    statusEl.className = ok ? "c-yellow" : "c-orange"
}

function setRemapStatus(text, ok = true) {
    if (!remapStatusEl) return
    remapStatusEl.textContent = text
    remapStatusEl.className = ok ? "c-yellow" : "c-orange"
}

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

function fmtList(arr) {
    if (!arr?.length) return "any"
    return arr.join(", ")
}

function renderRemaps(rules) {
    if (!remapListEl) return
    remapListEl.innerHTML = ""

    if (!rules.length) {
        remapListEl.textContent = "no remaps yet"
        return
    }

    for (const rule of rules) {
        const row = document.createElement("div")
        row.className = "flex-col"
        row.style.marginTop = "0.75rem"
        row.style.gap = "0.25rem"

        const line = document.createElement("p")
        const state = rule.enabled === false ? "off" : "on"
        line.textContent = `[${state}] ${rule.match?.name ?? "?"} → ${rule.toName ?? "?"} | class: ${fmtList(rule.match?.classes)} | group: ${fmtList(rule.match?.groups)} | teacher: ${fmtList(rule.match?.teachers)}`

        const actions = document.createElement("div")
        actions.style.display = "flex"
        actions.style.gap = "0.5rem"

        const toggleBtn = document.createElement("button")
        toggleBtn.type = "button"
        toggleBtn.textContent = rule.enabled === false ? "enable" : "disable"
        toggleBtn.addEventListener("click", async () => {
            const res = await fetch(`${REMAP_URL}/${rule._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ enabled: rule.enabled === false })
            })
            if (!res.ok) {
                setRemapStatus(`failed to update (${res.status})`, false)
                return
            }
            const data = await res.json()
            setRemapStatus(`updated (applied to ${data.applied ?? 0} lesson(s))`)
            await loadRemaps()
        })

        const delBtn = document.createElement("button")
        delBtn.type = "button"
        delBtn.textContent = "delete"
        delBtn.addEventListener("click", async () => {
            if (!confirm("Delete this remap?")) return
            const res = await fetch(`${REMAP_URL}/${rule._id}`, {
                method: "DELETE",
                headers: { Accept: "application/json" }
            })
            if (!res.ok) {
                setRemapStatus(`failed to delete (${res.status})`, false)
                return
            }
            setRemapStatus("deleted")
            await loadRemaps()
        })

        actions.append(toggleBtn, delBtn)
        row.append(line, actions)
        if (rule.note) {
            const note = document.createElement("p")
            note.className = "c-yellow"
            note.textContent = rule.note
            row.append(note)
        }
        remapListEl.append(row)
    }
}

async function loadRemaps() {
    if (!remapListEl) return
    try {
        const res = await fetch(REMAP_URL, { headers: { Accept: "application/json" } })
        if (!res.ok) {
            setRemapStatus(`failed to load (${res.status})`, false)
            return
        }
        const data = await res.json()
        renderRemaps(Array.isArray(data.rules) ? data.rules : [])
    } catch (err) {
        setRemapStatus(`failed to load: ${err}`, false)
    }
}

function wireRemapForm() {
    const form = document.getElementById("remapForm")
    if (!form) return

    form.addEventListener("submit", async (e) => {
        e.preventDefault()
        const fd = new FormData(form)
        const body = {
            classes: String(fd.get("classes") ?? ""),
            groups: String(fd.get("groups") ?? ""),
            teachers: String(fd.get("teachers") ?? ""),
            matchName: String(fd.get("matchName") ?? ""),
            toName: String(fd.get("toName") ?? ""),
            note: String(fd.get("note") ?? ""),
            enabled: true
        }

        const res = await fetch(REMAP_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(body)
        })

        if (!res.ok) {
            setRemapStatus(`failed to add (${res.status})`, false)
            return
        }

        const data = await res.json()
        setRemapStatus(`added (applied to ${data.applied ?? 0} lesson(s))`)
        form.reset()
        await loadRemaps()
    })
}

wireNotifyForm(document.getElementById("testNotifyForm"))
wireNotifyForm(document.getElementById("specificNotifyForm"))
wireRemapForm()
loadRemaps()
