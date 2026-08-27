const rows = Array.from(document.querySelectorAll(".timeRow"))

const riga = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
})

const DAYS = { Mon: "1", Tue: "2", Wed: "3", Thu: "4", Fri: "5", Sat: "6", Sun: "7" }

function rigaNow() {
    const parts = {}
    riga.formatToParts(new Date()).forEach(p => parts[p.type] = p.value)

    return {
        day: DAYS[parts.weekday],
        minutes: Number(parts.hour) * 60 + Number(parts.minute)
    }
}

function toMinutes(time) {
    const [hour, minute] = time.split(":").map(Number)
    return hour * 60 + minute
}

function update() {
    const now = rigaNow()

    rows.forEach(row => {
        const active = row.dataset.days.split(",").includes(now.day)
            && now.minutes >= toMinutes(row.dataset.start)
            && now.minutes < toMinutes(row.dataset.end)

        row.classList.toggle("now", active)
    })
}

update()
setInterval(update, 20000)

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) update()
})
