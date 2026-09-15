
import { setup as makeSearchable } from "/public/js/search.js"

export const settings = {
    url: `${window.location.origin}/v2/schedule`,
    weekData: null,
    values: {
        week: null,
        main: null
    },
    weekDayNames: {},
    weekDates: {},
    elements: {
        week: null,
        main: null
    },
    formats: {
        class: `<span>%name%</span><br><span>%classroom% %teacher%</span>`,
        teacher: `%name%<br>%classroom% %class%`,
        classroom: `%name%<br>%teacher% %class%`
    },
    coloring: { 
        class: '%name%-%teacher%',
        teacher: '%name%-%class%',
        classroom: '%class%-%teacher%'
    },
    times: {
        normal: [
            ["8:30", "9:50"],
            ["9:10", "11:30"],
            ["12:30", "13:50"],
            ["14:00", "15:20"],
            ["15:30", "16:50"],
            ["17:00", "18:20"]
        ],
        weekend: [
            ["8:10", "9:30"],
            ["9:40", "11:00"],
            ["11:10", "12:30"],
            ["13:00", "14:20"],
            ["14:30", "15:50"],
            ["16:00", "17:20"]
        ]
    }
}

//
//   utils
//

async function getJSON(url) {
    try {
        return await fetch(url).then(r => r.json())
    } catch (err) {
        console.warn(`Failed to fetch ${url}: ${err}`)
        return { success: false }
    }
}

async function getSchoolData(type, ignore, searchable) {
    const [weeksData, mainData] = await Promise.all([
        getJSON(`${settings.url}/weeks/list`),
        getJSON(`${settings.url}/${type}/list`)
    ])

    const weeks = weeksData.data ?? []
    const mains = (mainData.data ?? []).filter(i => i && i !== "Koordinators")

    if (!ignore[0] && weeksData.currentWeek) settings.values.week = weeksData.currentWeek

    weeks.forEach(w => {
        settings.weekDayNames[w.id] = w.days ?? ["0", "1", "2", "3", "4"]
        settings.weekDates[w.id] = w.dateFrom
    })

    setWeekOptions(settings.elements.week, weeks, weeksData.currentWeek)

    // a remembered value that no longer exists would leave the page empty
    if (!ignore[1] || !mains.includes(settings.values.main)) settings.values.main = mains[0] ?? null

    setMainOptions(settings.elements.main, mains, settings.values.main, searchable)
}

async function getWeekData(type, week, getter) {
    const dayNames = settings.weekDayNames[week] ?? ["0", "1", "2", "3", "4"]

    if (getter == null) {
        settings.weekData = { data: {} }
        return
    }

    await fetch(`${settings.url}/${type}/${encodeURIComponent(getter)}/week/${week}`)
        .then(res => res.json())
        .then((data) => {
            if (!data.success || !Array.isArray(data.lessons)) {
                settings.weekData = { data: {} }
                return
            }

            const byDay = {}

            data.lessons.forEach(lesson => {
                const d = lesson.day
                const p = Number(lesson.period) 

                if (!byDay[d]) byDay[d] = {}
                if (!byDay[d][p]) byDay[d][p] = []

                byDay[d][p].push(lesson)
            })

            const transformed = {}

            const globalMaxPeriod = Math.max(
                0,
                ...Object.values(byDay).flatMap(day => Object.keys(day).map(Number))
            )

            Object.keys(byDay).sort().forEach(d => {
                const dayLessons = byDay[d]
                const arr = []

                for (let p = 1; p <= globalMaxPeriod; p++) {
                    const lessons = dayLessons[p]

                    if (lessons) {
                        arr.push(lessons
                            .sort((a, b) => {
                                if (a.group[0] === "all") return -1
                                if (b.group[0] === "all") return 1
                                
                                return a.group[0].localeCompare(b.group[0])
                            })
                            .map(l => ({
                                start: l.lessonStart,
                                end: l.lessonEnd,
                                name: l.name,
                                teacher: l.teachers[0],
                                classroom: l.classroom,
                                class: l.class.join(", "),
                                group: l.group[0] === "all" ? null : l.group[0].replace("grupa", "gr."),
                                removed: !!l.removed,
                                changes: Array.isArray(l.changes) ? l.changes : []
                            })))
                    } else {
                        arr.push(null) 
                    }
                }
                transformed[d] = {
                    index: Number(d),
                    day: dayNames[Number(d)] ?? d,
                    data: arr
                }
            })

            settings.weekData = { data: transformed }
        })
        .catch(() => { settings.weekData = { data: {} } })
}

function createTable(type, container) {
    // reset table
    container.innerHTML = ''

    const days = Object.values(settings.weekData?.data ?? {})
    if (!days.length) {
        const empty = document.createElement('p')
        empty.innerText = navigator.onLine
            ? t('table.empty')
            : t('table.offline')

        container.appendChild(empty)
        return
    }

    // create table element
    const table = document.createElement('table')
    table.style.width = '100%'

    // determine max lessons in a day for header
    const maxLessons = Math.max(
        ...days.map(d => d.data.length)
    )

    // header logic
    const thead = document.createElement('thead')
    const dayTr = document.createElement('tr')

    const dayTh = document.createElement('th')
    dayTh.innerText = t('day')
    dayTr.appendChild(dayTh)

    for (let i = 1; i <= maxLessons; i++) {
        const th = document.createElement('th')
        th.innerText = t('table.period', { n: i })
        dayTr.appendChild(th)
    }

    thead.appendChild(dayTr)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')

    // insert lessons and days
    days.forEach((day, dayIndex) => {
        const row = document.createElement('tr')

        const dayCell = document.createElement('td')
        dayCell.classList.add('day')

        const dayParts = day.day.split(',').map(part => part.trim())
        dayCell.innerHTML = dayParts.join(', <br>')

        row.appendChild(dayCell)

        day.data.forEach((lessons, index) => {
            const cellContainer = document.createElement('td')
            cellContainer.classList.add("lesson-cell")

            if (lessons != null) {
                const activeLessons = lessons.filter(l => !l.removed)
                const removedLessons = lessons.filter(l => l.removed)
                const isGrouped = activeLessons.length > 1

                if (activeLessons.length === 0) {
                    const hasLessonAfter = day.data.slice(index + 1).some(slot =>
                        slot !== null && slot.some(l => !l.removed)
                    )

                    if (hasLessonAfter || removedLessons.some(l => l.changes?.length)) {
                        cellContainer.style.backgroundColor = "var(--dgray)"
                    }

                    const withChanges = removedLessons.find(l => l.changes?.length)
                    if (withChanges) {
                        const body = document.createElement('div')
                        body.className = 'lesson-body'

                        const btn = document.createElement('button')
                        btn.type = 'button'
                        btn.className = 'change-btn'
                        btn.title = tr("changes.title", { en: "schedule changes", lv: "saraksta izmaiņas" })
                        btn.setAttribute('aria-label', btn.title)
                        btn.innerHTML = '<i class="fa-solid fa-code-compare"></i>'
                        btn.addEventListener('click', (e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            openChangesModal(withChanges, withChanges.changes, type)
                        })

                        body.appendChild(btn)
                        cellContainer.appendChild(body)
                    }
                } else {
                    if (activeLessons[0].start && activeLessons[0].end) {
                        cellContainer.dataset.day = day.index
                        cellContainer.dataset.start = activeLessons[0].start
                        cellContainer.dataset.end = activeLessons[0].end
                    }

                    if (isGrouped) {
                        cellContainer.style.overflow = 'hidden'
                        cellContainer.style.padding = '0'
                    }

                    activeLessons.forEach((lesson, i) => {
                        const target = isGrouped ? document.createElement('div') : cellContainer

                        target.style.backgroundColor = randomColorFromString(
                            settings.coloring[type]
                                .replace('%name%', lesson.name)
                                .replace('%teacher%', lesson.teacher)
                                .replace('%class%', lesson.class)
                        )

                        if (isGrouped) {
                            target.className = 'lesson-group-entry'
                            const isFirst = i === 0
                            const isLast = i === activeLessons.length - 1
                            target.style.borderRadius = isFirst
                                ? '0.25rem 0.25rem 0 0'
                                : isLast
                                    ? '0 0 0.25rem 0.25rem'
                                    : '0'
                        }

                        const groupBadge = lesson.group
                            ? `<span class="group-badge">${lesson.group}</span> `
                            : ''

                        const body = document.createElement('div')
                        body.className = 'lesson-body'

                        if (lesson.changes?.length) {
                            const btn = document.createElement('button')
                            btn.type = 'button'
                            btn.className = 'change-btn'
                            
                            btn.title = tr("changes.title", { en: "schedule changes", lv: "saraksta izmaiņas" })
                            btn.setAttribute('aria-label', btn.title)
                            btn.innerHTML = '<i class="fa-solid fa-code-compare"></i>'

                            btn.addEventListener('click', (e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                openChangesModal(lesson, lesson.changes, type)
                            })
                            body.appendChild(btn)
                        }

                        const text = document.createElement('div')
                        text.className = 'lesson-text'
                        text.innerHTML = groupBadge + settings.formats[type]
                            .replace('%name%', lesson.name)
                            .replace('%teacher%', `<a class="colorText" href="/teacher?teacher=${encodeURIComponent(lesson.teacher)}">${lesson.teacher}</a>`)
                            .replace('%class%', `<a class="colorText" href="/class?class=${encodeURIComponent(lesson.class)}">${lesson.class}</a>`)
                            .replace('%classroom%', `<a class="colorText" href="/classroom?classroom=${encodeURIComponent(lesson.classroom)}">${lesson.classroom}</a>`)

                        body.appendChild(text)
                        target.replaceChildren(body)

                        if (isGrouped) cellContainer.appendChild(target)
                    })
                }
            } else {
                const hasLessonAfter = day.data.slice(index + 1).some(l => l !== null)

                if (hasLessonAfter) {
                    cellContainer.style.backgroundColor = "var(--dgray)"
                }
            }

            row.appendChild(cellContainer)
        })
        
        const missing = maxLessons - day.data.length;
        for (let i = 0; i < missing; i++) {
            const emptyCell = document.createElement('td')
            emptyCell.innerHTML = '&nbsp;'
            row.appendChild(emptyCell)
        }

        tbody.appendChild(row)

        if (dayIndex < days.length - 1) {
            const sepRow = document.createElement('tr')
            const sepCell = document.createElement('td')

            sepCell.colSpan = maxLessons + 1
            sepCell.style.height = '2px'
            sepCell.style.padding = '0'
            sepCell.style.backgroundColor = 'var(--dgray)'

            sepRow.appendChild(sepCell)
            tbody.appendChild(sepRow)
        }
    })

    table.appendChild(tbody)
    container.appendChild(table)

    markNow()
}

function setWeekOptions(element, data, primary = null) {
    element.innerHTML = ''

    data.forEach((week, index) => {
        const option = document.createElement('option')

        const label = `[${index + 1}] ${week.dateFrom}`

        option.selected = week.id === primary
        option.textContent = option.selected ? `${label} ${t('week.current')}` : label

        option.value = week.id
        element.appendChild(option)
    })
}

function setMainOptions(element, data, primary = null, searchable) {
    element.innerHTML = ''

    data.forEach((info) => {
        const option = document.createElement('option')

        if (info === primary) {
            option.selected = true
        }

        option.value = info
        option.innerHTML = info

        element.appendChild(option)
    })

    searchable && makeSearchable(element)
}

//
//   changes modal
//
const changeDateFmt = new Intl.DateTimeFormat(window.LANG === "lv" ? "lv-LV" : "en-GB", {
    timeZone: "Europe/Riga",
    dateStyle: "medium",
    timeStyle: "short"
})

let changesModal = null

function tr(key, fallbacks) {
    const text = t(key)
    if (text !== key) return text
    return fallbacks[window.LANG] ?? fallbacks.lv ?? key
}

function copyLesson(lesson) {
    return {
        name: lesson.name,
        teacher: lesson.teacher,
        classroom: lesson.classroom,
        class: lesson.class,
        group: lesson.group,
        start: lesson.start,
        end: lesson.end
    }
}

function applyChange(state, change, reverse = false) {
    const value = reverse ? change.from : change.to

    switch (change.type) {
        case "name":
            state.name = value
            break
        case "classroom":
            state.classroom = value
            break
        case "teachers":
            state.teacher = Array.isArray(value) ? (value[0] ?? "") : String(value ?? "")
            break
        case "times": {
            const match = String(value ?? "").match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/)
            if (match) {
                state.start = match[1]
                state.end = match[2]
            }
            break
        }
    }
}

function buildChangeSnapshots(lesson, changes) {
    const sorted = [...changes].sort((a, b) => new Date(a.date) - new Date(b.date))
    const state = copyLesson(lesson)

    // walk newest → oldest to recover the original lesson
    for (let i = sorted.length - 1; i >= 0; i--) {
        applyChange(state, sorted[i], true)
    }

    const snapshots = [{ lesson: copyLesson(state), date: null }]

    for (const change of sorted) {
        applyChange(state, change, false)
        const last = snapshots[snapshots.length - 1]
        const sameMoment = last.date && new Date(last.date).getTime() === new Date(change.date).getTime()

        if (sameMoment) {
            last.lesson = copyLesson(state)
        } else {
            snapshots.push({ lesson: copyLesson(state), date: change.date })
        }
    }

    return snapshots
}

function renderChangeLessonCell(lesson, type) {
    const cell = document.createElement("div")
    cell.className = "lesson-cell changeLessonCell"

    if (!lesson.name) {
        cell.style.backgroundColor = "var(--dgray)"
        cell.style.minHeight = "2.25rem"
        return cell
    }

    cell.style.backgroundColor = randomColorFromString(
        settings.coloring[type]
            .replace("%name%", lesson.name)
            .replace("%teacher%", lesson.teacher)
            .replace("%class%", lesson.class)
    )

    const groupBadge = lesson.group
        ? `<span class="group-badge">${lesson.group}</span> `
        : ""

    cell.innerHTML = groupBadge + settings.formats[type]
        .replace("%name%", lesson.name)
        .replace("%teacher%", lesson.teacher)
        .replace("%class%", lesson.class)
        .replace("%classroom%", lesson.classroom)

    return cell
}

function ensureChangesModal() {
    if (changesModal) return changesModal

    const overlay = document.createElement("div")
    overlay.className = "modalOverlay"
    overlay.hidden = true
    overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="changesModalTitle">
            <div class="modalHeader">
                <h2 id="changesModalTitle"></h2>
                <button type="button" class="modalClose">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modalBody"></div>
        </div>
    `

    const close = () => {
        overlay.hidden = true
    }

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close()
    })

    overlay.querySelector(".modalClose").addEventListener("click", close)

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !overlay.hidden) close()
    })

    document.body.appendChild(overlay)
    changesModal = overlay
    return overlay
}

function openChangesModal(lesson, changes, type) {
    const overlay = ensureChangesModal()
    const title = overlay.querySelector("#changesModalTitle")
    const closeBtn = overlay.querySelector(".modalClose")
    const body = overlay.querySelector(".modalBody")

    title.textContent = tr("changes.title", { en: "schedule changes", lv: "saraksta izmaiņas" })
    closeBtn.setAttribute("aria-label", tr("changes.close", { en: "close", lv: "aizvērt" }))
    body.replaceChildren()

    const timeline = document.createElement("div")
    timeline.className = "changeTimeline"

    // newest on top, oldest at the bottom — arrows point up
    const snapshots = buildChangeSnapshots(lesson, changes).reverse()

    snapshots.forEach((snapshot, i) => {
        if (i > 0) {
            const arrow = document.createElement("div")
            arrow.className = "changeTimelineArrow"
            arrow.innerHTML = '<i class="fa-solid fa-arrow-up"></i>'
            timeline.appendChild(arrow)
        }

        const item = document.createElement("div")
        item.className = "changeSnapshot" + (i === 0 ? " changeSnapshotRecent" : "")

        if (snapshot.date) {
            const meta = document.createElement("div")
            meta.className = "changeMeta"
            meta.textContent = changeDateFmt.format(new Date(snapshot.date))
            item.appendChild(meta)
        }

        item.appendChild(renderChangeLessonCell(snapshot.lesson, type))
        timeline.appendChild(item)
    })

    body.appendChild(timeline)
    overlay.hidden = false
}

//
//   now
//
const riga = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
})

const RIGA_DAYS = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

function rigaNow() {
    const parts = {}
    riga.formatToParts(new Date()).forEach(p => parts[p.type] = p.value)

    const index = RIGA_DAYS[parts.weekday]
    const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))

    return {
        index,
        monday: new Date(today - index * 86400000).toISOString().slice(0, 10),
        minutes: Number(parts.hour) * 60 + Number(parts.minute)
    }
}

function toMinutes(time) {
    const [hour, minute] = time.split(":").map(Number)
    return hour * 60 + minute
}

export function markNow() {
    const now = rigaNow()
    const thisWeek = settings.weekDates[settings.values.week] === now.monday

    let current = null
    let next = null
    let nextStart = Infinity

    document.querySelectorAll('.lesson-cell[data-start]').forEach(cell => {
        cell.classList.remove('now', 'next')

        if (!thisWeek || Number(cell.dataset.day) !== now.index) return

        const start = toMinutes(cell.dataset.start)
        const end = toMinutes(cell.dataset.end)

        if (now.minutes >= start && now.minutes < end) {
            current = cell
        } else if (now.minutes < start && start < nextStart) {
            nextStart = start
            next = cell
        }
    })

    if (current) current.classList.add('now')
    else if (next) next.classList.add('next')
}

//
//   helper
//
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i)
        hash |= 0
    }
    return hash
}

function randomColorFromString(str) {
    const hash = Math.abs(hashCode(str))

    const hue = hash % 360
    const sat = 50 + (hash % 30)

    return `hsl(${hue}, ${sat}%, 25%)`
}

//
//   main
//
export async function setup(type, ignore = [false, false], searchable = true) {
    const table = document.getElementById('tableContainer')

    // get information from API
    await getSchoolData(type, ignore, searchable)
    await getWeekData(type, settings.values.week, settings.values.main)

    createTable(type, table)

    setInterval(markNow, 30000)

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) markNow()
    })

    settings.elements.week.addEventListener('change', async (e) => {
        settings.values.week = e.target.value

        await getWeekData(type, settings.values.week, settings.values.main)
        createTable(type, table)
    })

    settings.elements.main.addEventListener('change', async (e) => {
        settings.values.main = e.target.value

        localStorage.setItem("lastLookup" + (type.charAt(0).toUpperCase() + type.slice(1)), settings.values.main)

        await getWeekData(type, settings.values.week, settings.values.main)
        createTable(type, table)
    })
}
