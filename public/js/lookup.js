
import { setup as makeSearchable } from "/public/js/search.js"

export const settings = {
    url: `${window.location.origin}/v2/schedule`,
    adminUrl: `${window.location.origin}/v2/admin/lessons`,
    isAdmin: !!window.IS_ADMIN,
    type: null,
    table: null,
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
                                const ga = Array.isArray(a.group) ? a.group[0] : a.group
                                const gb = Array.isArray(b.group) ? b.group[0] : b.group
                                if (ga === "all") return -1
                                if (gb === "all") return 1
                                return String(ga ?? "").localeCompare(String(gb ?? ""))
                            })
                            .map(l => {
                                const groups = Array.isArray(l.group) ? l.group : [l.group].filter(Boolean)
                                const classes = Array.isArray(l.class) ? l.class : [l.class].filter(Boolean)
                                const teachers = Array.isArray(l.teachers) ? l.teachers : [l.teachers].filter(Boolean)
                                const group0 = groups[0]

                                return {
                                    id: l._id,
                                    start: l.lessonStart,
                                    end: l.lessonEnd,
                                    name: l.name,
                                    teacher: teachers[0],
                                    teachers,
                                    classroom: l.classroom,
                                    class: classes.join(", "),
                                    group: !group0 || group0 === "all" ? null : String(group0).replace("grupa", "gr."),
                                    removed: !!l.removed,
                                    adminModified: !!l.adminOverride?.active,
                                    adminModifiedAt: l.adminOverride?.modifiedAt ?? null,
                                    changes: Array.isArray(l.changes) ? l.changes : []
                                }
                            }))
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

                    if (hasLessonAfter || removedLessons.some(l => l.changes?.length || l.adminModified)) {
                        cellContainer.style.backgroundColor = "var(--dgray)"
                    }

                    const withChanges = removedLessons.find(l => l.changes?.length || l.adminModified)
                    const editable = settings.isAdmin
                        ? (removedLessons.find(l => l.id) ?? null)
                        : null

                    if (withChanges || editable) {
                        const body = document.createElement('div')
                        body.className = 'lesson-body'

                        if (withChanges) {
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
                        }

                        if (editable) {
                            const editBtn = document.createElement('button')
                            editBtn.type = 'button'
                            editBtn.className = 'admin-edit-btn'
                            editBtn.title = tr("admin.edit", { en: "edit lesson", lv: "rediģēt stundu" })
                            editBtn.setAttribute('aria-label', editBtn.title)
                            editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>'
                            editBtn.addEventListener('click', (e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                openAdminEditModal(editable)
                            })
                            body.appendChild(editBtn)
                        }

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

                        if (lesson.changes?.length || lesson.adminModified) {
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

                        if (settings.isAdmin && lesson.id) {
                            const editBtn = document.createElement('button')
                            editBtn.type = 'button'
                            editBtn.className = 'admin-edit-btn'
                            editBtn.title = tr("admin.edit", { en: "edit lesson", lv: "rediģēt stundu" })
                            editBtn.setAttribute('aria-label', editBtn.title)
                            editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>'
                            editBtn.addEventListener('click', (e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                openAdminEditModal(lesson)
                            })
                            body.appendChild(editBtn)
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
    const adminAt = lesson.adminModifiedAt ? new Date(lesson.adminModifiedAt).getTime() : null

    for (let i = sorted.length - 1; i >= 0; i--) {
        applyChange(state, sorted[i], true)
    }

    const snapshots = [{ lesson: copyLesson(state), date: null, admin: false }]

    for (const change of sorted) {
        applyChange(state, change, false)
        const last = snapshots[snapshots.length - 1]
        const changeTime = new Date(change.date).getTime()
        const sameMoment = last.date && new Date(last.date).getTime() === changeTime
        const isAdmin = change.by === "admin" || (adminAt !== null && changeTime === adminAt)

        if (sameMoment) {
            last.lesson = copyLesson(state)
            last.admin = last.admin || isAdmin
        } else {
            snapshots.push({ lesson: copyLesson(state), date: change.date, admin: isAdmin })
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

    const history = Array.isArray(changes) ? changes : []
    const snapshots = buildChangeSnapshots(lesson, history).reverse()

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
            meta.append(document.createTextNode(changeDateFmt.format(new Date(snapshot.date))))

            if (snapshot.admin) {
                const tag = document.createElement("span")
                tag.className = "admin-modified-tag"
                tag.textContent = tr("admin.modified", {
                    en: "modified by site admin",
                    lv: "mainījis vietnes admins"
                })
                meta.append(document.createTextNode(" · "))
                meta.append(tag)
            }

            item.appendChild(meta)
        }

        item.appendChild(renderChangeLessonCell(snapshot.lesson, type))
        timeline.appendChild(item)
    })

    body.appendChild(timeline)
    overlay.hidden = false
}

//
//   admin edit
//
let adminEditModal = null

async function reloadTable() {
    if (!settings.type || !settings.table) return
    await getWeekData(settings.type, settings.values.week, settings.values.main)
    createTable(settings.type, settings.table)
}

function ensureAdminEditModal() {
    if (adminEditModal) return adminEditModal

    const overlay = document.createElement("div")
    overlay.className = "modalOverlay"
    overlay.hidden = true
    overlay.innerHTML = `
        <div class="modal adminEditModal" role="dialog" aria-modal="true" aria-labelledby="adminEditTitle">
            <div class="modalHeader">
                <h2 id="adminEditTitle"></h2>
                <button type="button" class="modalClose">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <form class="adminEditForm">
                <label>
                    <span class="adminFieldLabel" data-field="name"></span>
                    <input name="name" type="text" autocomplete="off" required>
                </label>
                <label>
                    <span class="adminFieldLabel" data-field="classroom"></span>
                    <input name="classroom" type="text" autocomplete="off">
                </label>
                <label>
                    <span class="adminFieldLabel" data-field="teachers"></span>
                    <input name="teachers" type="text" autocomplete="off">
                </label>
                <div class="adminTimeRow">
                    <label>
                        <span class="adminFieldLabel" data-field="start"></span>
                        <input name="lessonStart" type="text" autocomplete="off" placeholder="8:30" required>
                    </label>
                    <label>
                        <span class="adminFieldLabel" data-field="end"></span>
                        <input name="lessonEnd" type="text" autocomplete="off" placeholder="9:50" required>
                    </label>
                </div>
                <label class="adminCheckRow">
                    <input name="removed" type="checkbox">
                    <span class="adminFieldLabel" data-field="removed"></span>
                </label>
                <p class="adminEditStatus c-yellow" hidden></p>
                <div class="adminEditActions actionBtns">
                    <button type="button" class="adminRevertBtn" hidden></button>
                    <button type="button" class="adminCancelBtn"></button>
                    <button type="submit" class="adminSaveBtn"></button>
                </div>
            </form>
        </div>
    `

    const close = () => { overlay.hidden = true }

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close()
    })
    overlay.querySelector(".modalClose").addEventListener("click", close)
    overlay.querySelector(".adminCancelBtn").addEventListener("click", close)

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !overlay.hidden) close()
    })

    document.body.appendChild(overlay)
    adminEditModal = overlay
    return overlay
}

function openAdminEditModal(lesson) {
    const overlay = ensureAdminEditModal()
    const form = overlay.querySelector(".adminEditForm")
    const title = overlay.querySelector("#adminEditTitle")
    const status = overlay.querySelector(".adminEditStatus")
    const revertBtn = overlay.querySelector(".adminRevertBtn")
    const closeBtn = overlay.querySelector(".modalClose")

    title.textContent = tr("admin.editTitle", { en: "edit lesson", lv: "rediģēt stundu" })
    closeBtn.setAttribute("aria-label", tr("admin.cancel", { en: "cancel", lv: "atcelt" }))

    overlay.querySelector('[data-field="name"]').textContent = tr("admin.name", { en: "subject", lv: "priekšmets" })
    overlay.querySelector('[data-field="classroom"]').textContent = tr("admin.classroom", { en: "classroom", lv: "kabinets" })
    overlay.querySelector('[data-field="teachers"]').textContent = tr("admin.teachers", { en: "teachers (comma-separated)", lv: "skolotāji (atdalīti ar komatu)" })
    overlay.querySelector('[data-field="start"]').textContent = tr("admin.start", { en: "start", lv: "sākums" })
    overlay.querySelector('[data-field="end"]').textContent = tr("admin.end", { en: "end", lv: "beigas" })
    overlay.querySelector('[data-field="removed"]').textContent = tr("admin.removed", { en: "mark as removed", lv: "atzīmēt kā noņemtu" })

    form.name.value = lesson.name ?? ""
    form.classroom.value = lesson.classroom ?? ""
    form.teachers.value = (lesson.teachers?.length ? lesson.teachers : [lesson.teacher].filter(Boolean)).join(", ")
    form.lessonStart.value = lesson.start ?? ""
    form.lessonEnd.value = lesson.end ?? ""
    form.removed.checked = !!lesson.removed

    status.hidden = true
    status.textContent = ""

    overlay.querySelector(".adminCancelBtn").textContent = tr("admin.cancel", { en: "cancel", lv: "atcelt" })
    overlay.querySelector(".adminSaveBtn").textContent = tr("admin.save", { en: "save", lv: "saglabāt" })

    revertBtn.hidden = !lesson.adminModified
    revertBtn.textContent = tr("admin.revert", { en: "remove site admin changes", lv: "noņemt vietnes admina izmaiņas" })
    revertBtn.onclick = async () => {
        const ok = window.confirm(tr("admin.revertConfirm", {
            en: "Restore this lesson to the schedule source and remove site admin changes?",
            lv: "Atjaunot šo stundu no saraksta avota un noņemt vietnes admina izmaiņas?"
        }))
        if (!ok) return

        revertBtn.disabled = true
        try {
            const res = await fetch(`${settings.adminUrl}/${encodeURIComponent(lesson.id)}/override`, {
                method: "DELETE",
                headers: { Accept: "application/json" }
            })
            const data = await res.json().catch(() => ({ success: false }))
            if (!res.ok || !data.success) throw new Error(data.error || "revert failed")

            overlay.hidden = true
            await reloadTable()
        } catch (err) {
            status.hidden = false
            status.textContent = tr("admin.revertFailed", { en: "failed to remove admin changes", lv: "neizdevās noņemt admina izmaiņas" })
            console.warn(err)
        } finally {
            revertBtn.disabled = false
        }
    }

    form.onsubmit = async (e) => {
        e.preventDefault()
        status.hidden = true

        const payload = {
            name: form.name.value.trim(),
            classroom: form.classroom.value.trim(),
            teachers: form.teachers.value.split(",").map(t => t.trim()).filter(Boolean),
            lessonStart: form.lessonStart.value.trim(),
            lessonEnd: form.lessonEnd.value.trim(),
            removed: !!form.removed.checked
        }

        const saveBtn = overlay.querySelector(".adminSaveBtn")
        saveBtn.disabled = true
        try {
            const res = await fetch(`${settings.adminUrl}/${encodeURIComponent(lesson.id)}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify(payload)
            })
            const data = await res.json().catch(() => ({ success: false }))
            if (!res.ok || !data.success) throw new Error(data.error || "save failed")

            overlay.hidden = true
            await reloadTable()
        } catch (err) {
            status.hidden = false
            status.textContent = tr("admin.saveFailed", { en: "failed to save lesson", lv: "neizdevās saglabāt stundu" })
            console.warn(err)
        } finally {
            saveBtn.disabled = false
        }
    }

    overlay.hidden = false
    form.name.focus()
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
    settings.type = type
    settings.table = table
    settings.isAdmin = !!window.IS_ADMIN

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
