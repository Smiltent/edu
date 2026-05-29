
export const settings = {
    url: `${window.location.origin}/v2/schedule`,
    weekData: null,
    values: {
        week: null,
        main: null
    },
    weekDayNames: {},
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
async function getSchoolData(type, ignore, searchable) {
    const [weeksData, mainData] = await Promise.all([
        fetch(`${settings.url}/weeks/list`).then(r => r.json()),
        fetch(`${settings.url}/${type}/list`).then(r => r.json())
    ])

    if (!ignore[0]) settings.values.week = weeksData.currentWeek

    weeksData.data.forEach(w => {
        settings.weekDayNames[w.id] = w.days ?? ["0", "1", "2", "3", "4"]
    })

    setWeekOptions(settings.elements.week, weeksData.data, weeksData.currentWeek)

    if (!ignore[1]) settings.values.main = mainData.data[0]

    setMainOptions(settings.elements.main, mainData.data, ignore[1] ? settings.values.main : null, searchable)
}

async function getWeekData(type, week, getter) {
    const dayNames = settings.weekDayNames[week] ?? ["0", "1", "2", "3", "4"]

    await fetch(`${settings.url}/${type}/${encodeURIComponent(getter)}/week/${week}`)
        .then(res => res.json())
        .then((data) => {
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
                                group: l.group[0] === "all" ? null : l.group[0].replace("grupa", "gr.")
                            })))
                    } else {
                        arr.push(null) 
                    }
                }
                transformed[d] = {
                    day: dayNames[Number(d)] ?? d,
                    data: arr
                }
            })

            settings.weekData = { data: transformed }
        })
}

function createTable(type, container) {
    // reset table
    container.innerHTML = ''

    // create table element
    const table = document.createElement('table')
    table.style.width = '100%'

    // determine max lessons in a day for header
    const maxLessons = Math.max(
        ...Object.values(settings.weekData.data).map(d => d.data.length)
    )

    // header logic
    const thead = document.createElement('thead')
    const dayTr = document.createElement('tr')

    const dayTh = document.createElement('th')
    dayTh.innerText = 'day'
    dayTr.appendChild(dayTh)

    for (let i = 1; i <= maxLessons; i++) {
        const th = document.createElement('th')
        th.innerText = `${i}. period`
        dayTr.appendChild(th)
    }

    thead.appendChild(dayTr)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')

    // insert lessons and days
    const days = Object.values(settings.weekData.data)
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
                const isGrouped = lessons.length > 1

                if (isGrouped) {
                    cellContainer.style.overflow = 'hidden'
                    cellContainer.style.padding = '0'
                }

                lessons.forEach((lesson, i) => {
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
                        const isLast = i === lessons.length - 1
                        target.style.borderRadius = isFirst
                            ? '0.25rem 0.25rem 0 0'
                            : isLast
                                ? '0 0 0.25rem 0.25rem'
                                : '0'
                    }

                    const groupBadge = lesson.group
                        ? `<span class="group-badge">${lesson.group}</span> `
                        : ''

                    target.innerHTML = groupBadge + settings.formats[type]
                        .replace('%name%', lesson.name)
                        .replace('%teacher%', `<a class="colorText" href="/teacher?teacher=${encodeURIComponent(lesson.teacher)}">${lesson.teacher}</a>`)
                        .replace('%class%', `<a class="colorText" href="/class?class=${encodeURIComponent(lesson.class)}">${lesson.class}</a>`)
                        .replace('%classroom%', `<a class="colorText" href="/classroom?classroom=${encodeURIComponent(lesson.classroom)}">${lesson.classroom}</a>`)

                    if (isGrouped) cellContainer.appendChild(target)
                })
            } else {
                const hasLessonAfter = day.data.slice(index + 1).some(l => l !== null)

                if (hasLessonAfter) {
                    cellContainer.style.backgroundColor = "var(--dgray)"
                    cellContainer.innerHTML = "No<br>Class"
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
}

function setWeekOptions(element, data, primary = null) {
    data.forEach((week) => {
        const option = document.createElement('option')

        if (week.id === primary) {
            option.selected = true
            option.innerHTML = `${week.dateFrom} [${week.id}] (current)`
        } else {
            option.innerHTML = `${week.dateFrom} [${week.id}]`
        }

        option.value = week.id
        element.appendChild(option)
    })
}

function setMainOptions(element, data, primary = null, searchable) {
    data.forEach((info) => {
        const option = document.createElement('option')
        if (info === "Koordinators") return 

        if (info === primary) {
            option.selected = true
        }

        option.value = info
        option.innerHTML = info

        element.appendChild(option)
    })

    searchable && makeSearchable(element)
}

// turns a select element, into a searchable one (for search.js)
function makeSearchable(element) {
    element.style.display = "none"
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
    const hue = Math.abs(hashCode(str)) % 360
    const sat = 50 + (Math.abs(hashCode(str)) % 30) 

    return `hsl(${hue}, ${sat}%, 25%)`
}

//
//   main
//
export async function setup(type, ignore = [false, false], searchable = false) {
    const table = document.getElementById('tableContainer')

    // get information from API
    await getSchoolData(type, ignore)
    await getWeekData(type, settings.values.week, settings.values.main)

    createTable(type, table)

    // setup event listeners
    settings.elements.week.addEventListener('change', async (e) => {
        settings.values.week = e.target.value

        await getWeekData(type, settings.values.week, settings.values.main, searchable)
        createTable(type, table)
    })

    settings.elements.main.addEventListener('change', async (e) => {
        settings.values.main = e.target.value

        // Store last lookup in localStorage
        localStorage.setItem("lastLookup" + (type.charAt(0).toUpperCase() + type.slice(1)), settings.values.main)

        await getWeekData(type, settings.values.week, settings.values.main, searchable)
        createTable(type, table)
    })
}
