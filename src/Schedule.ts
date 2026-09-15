
import RawScheduleData from "@/models/RawScheduleData.ts"
import { times, timesWeekend } from "@/util/time.ts"
import Lesson from "@/models/Lesson.ts"
import Week from "@/models/Week.ts"

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn()
        } catch (err: any) {
            if (i === retries - 1) throw err

            console.warn(`Retrying in ${delay * (i + 1)}ms after: ${err.message}`)
            await new Promise(r => setTimeout(r, delay * (i + 1)))
        }
    }
    throw new Error("unreachable")
}

export type SubjectChange = {
    day: string
    period: number
    from: string
    to: string
    class: string
    teachers: string[]
    classroom: string
}

export default class Schedule {
    private week!: string
    private addedParsedDaysData: string[] = []

    private index: any
    private data: any

    /**
     * Initializes the Schedule parser for a specific week
     * @param week The week to parse from Edupage
     */
    public async i(
        week: string,
    ) {
        this.week = week 
        await this.loadIndex(week)
    }

    /**
     * Stores the parsed lesson into the database
     * @returns Subject name changes detected during this parse
     */
    public async storeLessonData(): Promise<SubjectChange[]> {
        if (!this.index) await this.loadIndex(this.week)

        const weekObjectId = await Week.findOne({ id: this.week })
        if (weekObjectId === null) {
            console.error("Week doesn't exist...")
            return []
        }

        if (!this.addedParsedDaysData.includes(this.week)) {
            const days = this.index.daysRows.map((day: any) => day.name);

            await Week.findOneAndUpdate(
                { id: this.week },
                { days },
                { new: true }
            )
            
            this.addedParsedDaysData.push(this.week)
        }

        const existingLessons = await Lesson.find({ week: weekObjectId })
            .select('period day class group classroom name teachers lessonStart lessonEnd removed')
            .lean()
        const existingMap = new Map(
            existingLessons.map(l => [
                `${l.period}-${l.day}-${l.class}-${l.group}`,
                l
            ])
        )

        const bulkOps: any[] = []
        const seenKeys = new Set<string>()
        const subjectChanges: SubjectChange[] = []
            
        for (const card of this.index.cards) {
            // get lesson information
            const lesson = this.index.lessons[card.lessonid]
            if (!lesson) continue

            // index information
            const teachers = (lesson.teacherids ?? []).map((id: string) => this.index.teachers[id]).filter(Boolean)
            const classes = (lesson.classids ?? []).map((id: string) => this.index.classes[id]).filter(Boolean)
            const groups = (lesson.groupids ?? []).map((id: string) => this.index.groups[id]).filter(Boolean)

            const classroom = this.index.classrooms[card.classroomids]
            const subject = this.index.subjects[lesson.subjectid]

            // get day info
            const dayInfo = this.getDayById(card.days)
            if (!dayInfo) continue

            const { day, isLastDayOfWeek, name: dayName, shortName } = dayInfo
            const dayLabel = (dayName ?? "").split(",")[0].trim() || shortName || day
            const duration = Math.ceil(lesson.durationperiods / 2)
            const basePeriod = Math.ceil(card.period / 2)

            try {
                for (const clazz of classes) {
                    let period = basePeriod

                    // store each period
                    for (var i = 0; i < duration; i++, period++) {
                        const times = this.getPeriodTimes(period, isLastDayOfWeek)
                        if (!times) continue

                        const group = groups.find((g: any) => g.classid === clazz.id)
                        const groupName = (!group || group.entireclass) ? "all" : group.name

                        const query = {
                            week: weekObjectId,
                            period,
                            day,
                            class: clazz.name,
                            group: groupName
                        }

                        const data = {
                            classroom: classroom?.name ?? "N/A",
                            name: subject?.name ?? "N/A",
                            teachers: teachers?.map((t: any) => t.name) ?? [],
                            lessonStart: times[0],
                            lessonEnd: times[1],
                            removed: false
                        }

                        const key = `${period}-${day}-${clazz.name}-${groupName}`
                        seenKeys.add(key)

                        const existing = existingMap.get(key)
                        const changes: any[] = []
                        const now = new Date()

                        if (existing) {
                            if (existing.classroom !== data.classroom) changes.push({
                                date: now, type: "classroom", from: existing.classroom, to: data.classroom
                            })

                            if (existing.name !== data.name) {
                                changes.push({ 
                                    date: now, type: "name", from: existing.name, to: data.name
                                })
                                subjectChanges.push({
                                    day: dayLabel,
                                    period,
                                    from: existing.name || "—",
                                    to: data.name,
                                    class: clazz.name,
                                    teachers: data.teachers,
                                    classroom: data.classroom
                                })
                            }

                            if (JSON.stringify([...(existing.teachers ?? [])].sort()) !== JSON.stringify([...data.teachers].sort())) changes.push({
                                date: now, type: "teachers", from: existing.teachers ?? [], to: data.teachers
                            })

                            if (existing.lessonStart !== data.lessonStart || existing.lessonEnd !== data.lessonEnd) changes.push({
                                date: now, type: "times", from: `${existing.lessonStart}-${existing.lessonEnd}`, to: `${data.lessonStart}-${data.lessonEnd}`
                            })
                        }

                        const update: any = { $set: data }
                        if (changes.length) update.$push = { changes: { $each: changes } }

                        bulkOps.push({
                            updateOne: {
                                filter: query,
                                update,
                                upsert: true
                            }
                        })
                    }
                }
            } catch (err) {
                console.error(`Error trying to store Lesson Data: ${err}`)
            }
        }

        // soft-delete lessons that disappeared so change history remains visible
        for (const [key, existing] of existingMap.entries()) {
            if (seenKeys.has(key) || existing.removed) continue

            const now = new Date()
            const changes: any[] = []

            if (existing.name) changes.push({
                date: now, type: "name", from: existing.name, to: ""
            })
            if (existing.classroom) changes.push({
                date: now, type: "classroom", from: existing.classroom, to: ""
            })
            if ((existing.teachers ?? []).length) changes.push({
                date: now, type: "teachers", from: existing.teachers, to: []
            })

            const dayLabel = this.getDayLabel(existing.day)
            const className = Array.isArray(existing.class) ? existing.class[0] : existing.class

            if (existing.name) {
                subjectChanges.push({
                    day: dayLabel,
                    period: existing.period,
                    from: existing.name,
                    to: "—",
                    class: className,
                    teachers: existing.teachers ?? [],
                    classroom: existing.classroom ?? ""
                })
            }

            const update: any = {
                $set: {
                    removed: true,
                    name: "",
                    classroom: "",
                    teachers: []
                }
            }
            if (changes.length) update.$push = { changes: { $each: changes } }

            bulkOps.push({
                updateOne: {
                    filter: { _id: existing._id },
                    update
                }
            })
        }

        if (bulkOps.length > 0) {
            const chunkSize = 500
            for (let i = 0; i < bulkOps.length; i += chunkSize) {
                const chunk = bulkOps.slice(i, i + chunkSize)
                await withRetry(() => Lesson.bulkWrite(chunk, { ordered: false }))
            }
        }

        console.debug(`Stored Lesson Data for Week ${this.week}`)
        return subjectChanges
    }

    /**
     * Loads the index data from the Database for a specific week
     * @param week The week data to load from EduPage
     */
    private async loadIndex(week: string) {
        const payload: any = await RawScheduleData.findOne({ week }).lean()
        if (!payload) throw new Error(`No raw data found for week ${week}`)  

        this.data = payload.data
        this.index = {
            classrooms: this.indexById(this.data[11]["data_rows"]),
            classes: this.indexById(this.data[12]["data_rows"]),
            subjects: this.indexById(this.data[13]["data_rows"]),
            teachers: this.indexById(this.data[14]["data_rows"]),
            groups: this.indexById(this.data[15]["data_rows"]),
            lessons: this.indexById(this.data[18]["data_rows"]),

            dayDefs: this.data[4]["data_rows"],
            daysRows: this.data[7]["data_rows"],
            cards: this.data[20]["data_rows"],

            times,
            timesWeekend
        }
    }

    /**
     * Indexes an array of rows by it's ID
     * @param rowsData Array of rows data
     * @returns Indexed rows data by ID
     */
    private indexById(rowsData: any[]) {
        const map: Record<string, any> = {}
        
        for (const row of rowsData) map[row.id] = row
        return map
    }

    /**
     * Gets the correct period time for a specific period and it's day (our weekends have different times)
     * @param period Period number
     * @param isLastDayOfWeek Wethever it's the last day of the week
     * @returns The period times || null if something went wrong (????)
     */
    private getPeriodTimes(period: number, isLastDayOfWeek: boolean) {
        const times = period - 1
        const validate = isLastDayOfWeek ? this.index.timesWeekend[times] : this.index.times[times]

        return validate ?? null
    }

    /**
     * Resolves a short day label from a stored day id (for notifications)
     */
    private getDayLabel(dayId: string) {
        const row = this.index?.daysRows?.find((l: any) => l.id === String(dayId))
        if (!row) return String(dayId)

        return (row.name ?? "").split(",")[0].trim() || row.short || String(dayId)
    }

    /**
     * Gets a day object by the ID
     * @param daysdefid Daysdefs ID
     * @returns The day object data
     */
    private getDayById(daysdefid: string = "00001") {   
        const dayDef = this.index.dayDefs.find((l: any) => l.vals[0] === daysdefid)
        if (!dayDef) return null

        const dayRows = this.index.daysRows
        const day = String(Number(dayDef.id.replace("*", "")) - 1) // gets the correct day - edupages likes to add a random *

        const row = dayRows.find((l: any) => l.id === day)
        if (!row) return null

        const index = dayRows.findIndex((l: any) => l.id === day)

        return {
            day,
            name: row.name,
            shortName: row.short,
            isLastDayOfWeek: index === dayRows.length - 1 // checks if its the last one
        }
    }
}