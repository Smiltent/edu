
import { pLimit } from "@/util/pLimit"
import checkDiff from "@/util/diff"
import Schedule from "./Schedule"
import axios from "axios"

import RawScheduleData from "@/models/RawScheduleData.ts"
import Week from "@/models/Week.ts"
import { express } from ".."

const createHeaders = (url: string) => ({
    "Referer": url,
    "Content-Type": "application/json; charset=utf-8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0",
    "Accept": "*/*"
})

var alreadyWarned = false
var displayedYear = false

export default class Scraper {
    private url: string
    private weeks: any

    public currentWeek: string = "0"
    public currentYear: string = "0000"

    constructor(url: string) {
        console.debug("Running a new Scraper.ts instance...")

        this.url = this.normalizeUrl(url);

        (async () => {
            await this.storeAllWeeksToDatabase()
            
            setInterval(async () => {    
                await this.storeAllWeeksToDatabase()
            }, 5 * 60 * 1000) // 5 min

            console.debug(`Current week: ${this.currentWeek}`)
        })()
    }

    /**
     * Fetches all the weeks from EduPage and stores them into the database
     */
    public async storeAllWeeksToDatabase() {
        const limit = pLimit(3)

        try {
            this.currentYear = await this.fetchYear()
            this.weeks = await this.getWeeksData()

            this.currentWeek = this.weeks.default_num

            await Week.bulkWrite(this.weeks.timetables.map((week: any) => ({
                updateOne: {
                    filter: { id: week.tt_num },
                    update: { $set: { id: week.tt_num, year: week.year, dateFrom: week.datefrom } },
                    upsert: true
                }
            })))

            await Promise.all(this.weeks.timetables.map((week: any) => limit(async () => {
                const canParse = await this.storeWeekToDatabase(week.tt_num)
                if (!canParse) return

                const parser = new Schedule()
                await parser.i(week.tt_num)
                await parser.storeLessonData()
            })))
        } catch (err) {
            console.error(`Failed to store all weeks to database: ${err}`)
        }
    }

    /**
     * Reparses every single stored week in the Database
     * Useful for when schema has changed
     */
    public async reparseAllWeeksInDatabase() {
        console.warn("Reparsing all weeks!")
        const limit = pLimit(3)

        try {
            this.currentYear = await this.fetchYear()
            const weekNums = (await RawScheduleData.find({}).select("week -_id")).map(item => item.week)

            await Week.bulkWrite(weekNums.map(week => ({
                updateOne: {
                    filter: { id: week },
                    update: { $setOnInsert: { id: week, year: this.currentYear, dateFrom: "unknown" } },
                    upsert: true
                }
            })))

            await Promise.all(weekNums.map(week => limit(async () => {
                const parser = new Schedule()
                await parser.i(week)
                await parser.storeLessonData()
            })))
        } catch (err) {
            console.error(`Failed to reparse weeks in database: ${err}`)
        }
    }

    /**
     * Obtain the weeks data from EduPage
     * @returns Weeks Data
     */
    public async getWeeksData() {
        try {
            const { data: res } = await axios.post(
                `${this.url}/timetable/server/ttviewer.js?__func=getTTViewerData`, 
                { __args: [ null, this.currentYear ], __gsh: "00000000" }, 
                { headers: createHeaders(this.url) }
            )

            var data = res.r.regular

            // edge case - in case if it's empty or null
            if (!data.default_num) {
                data.default_num = data.timetables.at(-1).tt_num

                if (!alreadyWarned) {
                    console.warn("Default_num is empty, falling back to most recent week...")
                    alreadyWarned = true
                }
            }

            return data
        } catch (err) {
            console.error(`Failed to fetch weeks data from ${this.url}: ${err}`)
            return null
        }
    }

    /**
     * Store the week into the database
     * @param week EduPage week
     * @returns successfullness
     */
    private async storeWeekToDatabase(week: string) {
        try {
            const { data: res } = await axios.post(
                `${this.url}/timetable/server/regulartt.js?__func=regularttGetData`, 
                { __args: [null, week], __gsh: "00000000" },
                { headers: createHeaders(this.url) }
            )
            
            // refreshed the weeks - yes, the message is in plural
            if (res.error === "Timetable does not exists") {
                this.weeks = await this.getWeeksData()
                console.debug(`Week ${week} has been removed`)

                return false
            }

            const incoming = res.r.dbiAccessorRes.tables
            const existing = await RawScheduleData.findOne({ week })

            const isNew = !existing
            const isModified = existing && checkDiff(existing.data, incoming) !== "no changes"

            if (!isNew && !isModified) return false

            if (isNew) {
                console.debug(`New week ${week} — storing to database.`)
                express.sendWSMessage(JSON.stringify({
                    week,
                    type: "new",
                }))

            } else {
                console.debug(`Updating week ${week} — storing to database.`)
                express.sendWSMessage(JSON.stringify({
                    week,
                    type: "update",
                }))
            }
            
            await RawScheduleData.updateOne(
                { week },
                { $set: { data: incoming } },
                { upsert: true }
            )

            return true
        } catch (err) {
            console.error(`Failed to fetch week ${week} from ${this.url}: ${err}`)
            return false
        }
    }

    /**
     * Obtains the year variable from EduPage. Why don't they just get the current year?
     * @returns the current school year from EduPage
     */
    private async fetchYear() {
        var year = new Date().getFullYear()
        const yearRes = await axios.get(`${this.url}/timetable/view.php`, {
            headers: createHeaders(this.url)
        })

        // extracts the year variable from the page
        const match = yearRes.data.match(/ASC\.req_props\s*=\s*({[\s\S]*?});/)
        if (match) {
            var objString = match[1];

            objString = objString
                .replace(/(\w+):/g, '"$1":')
                .replace(/'/g, '"')

            year = JSON.parse(objString).year_auto
        }

        !displayedYear ? console.info(`Current School Year: ${year}`) : null
        displayedYear = true

        return String(year)
    }

    /**
     * Edge-case handling URL normalization, in case user forgets to add protocol or the domain
     * @param url uncomplete EduPage URL
     * @returns complete EduPage URL
     */
    private normalizeUrl(url: string) {
        if (!url.includes("edupage.org")) url = `${url}.edupage.org`
        if (!url.startsWith("https://") && !url.startsWith("http://")) url = `https://${url}`

        return url
    }
}