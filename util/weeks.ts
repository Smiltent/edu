
import Week from "@/models/Week.ts"
import cache from "@/util/cache.ts"

import { scraper } from "@/index.ts"

export const TTL = 5 * 60 * 1000

/**
 * Looks a week document up by it's EduPage number, cached because every lookup needs it
 * @param week EduPage week number
 * @returns The week document || null when that week was never stored
 */
export async function getWeekDoc(week: string) {
    const cacheKey = `week-doc-${week}`

    const hit = cache.get(cacheKey)
    if (hit) return hit

    const doc = await Week.findOne({ id: week })
    if (doc) cache.set(cacheKey, doc, TTL)

    return doc
}

/**
 * The week the lists are built from. EduPage doesn't always hand out a current week
 * (holidays), so the newest stored one is used instead of showing nothing at all
 * @returns The week document || null when nothing is stored yet
 */
export async function getCurrentWeekDoc() {
    const current = scraper?.currentWeek

    if (current && current !== "0") {
        const doc = await getWeekDoc(current)
        if (doc) return doc
    }

    const cacheKey = "week-doc-latest"

    const hit = cache.get(cacheKey)
    if (hit) return hit

    const doc = await Week.findOne().sort({ dateFrom: -1 })
    if (doc) cache.set(cacheKey, doc, TTL)

    return doc
}
