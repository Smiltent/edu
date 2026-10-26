
import Week from "@/models/Week.ts"
import cache from "@/util/cache.ts"

import { scraper } from "@/index.ts"

export const TTL = 5 * 60 * 1000

export async function getWeekDoc(week: string) {
    const cacheKey = `week-doc-${week}`

    const hit = cache.get(cacheKey)
    if (hit) return hit

    const doc = await Week.findOne({ id: week })
    if (doc) cache.set(cacheKey, doc, TTL)

    return doc
}

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
