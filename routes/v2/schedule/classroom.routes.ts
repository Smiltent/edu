
import Lesson from '@/models/Lesson'
import Week from '@/models/Week'
import cache from '@/util/cache'

import { scraper } from '@/index'
import { Router } from 'express'
const router = Router()

const TTL = 5 * 60 * 1000

async function getWeekDoc(week: string) {
    const cacheKey = `week-doc-${week}`
    const hit = cache.get(cacheKey)
    if (hit) return hit

    const doc = await Week.findOne({ id: week })
    if (doc) cache.set(cacheKey, doc, TTL)
    return doc
}

router.get('/list', async (_, res) => {
    try {
        const hit = cache.get('classroom-list')
        if (hit) return res.json(hit)

        const weekDoc = await getWeekDoc(scraper.currentWeek)
        const data = await Lesson.distinct('classroom', { week: weekDoc?._id })

        const body = { success: true, data }
        cache.set('classroom-list', body, TTL)
        return res.json(body)
    } catch (err) {
        console.error(`Error listing all classrooms: ${err}`)
        return res.status(500).json({ success: false, data: 'Internal Server Error' })
    }
})

router.get('/:classroom/week/:week', async (req, res) => {
    const { classroom, week } = req.params
    if (!classroom) return res.status(400).json({ success: false, data: 'Missing classroom' })
    if (!week) return res.status(400).json({ success: false, data: 'Missing week number' })

    try {
        const cacheKey = `classroom-${week}-${classroom}`
        const hit = cache.get(cacheKey)
        if (hit) return res.json(hit)

        const weekDoc = await getWeekDoc(week)
        if (!weekDoc) return res.status(404).json({ success: false, data: 'Week not found' })

        const lessons = await Lesson.find({ week: weekDoc._id, classroom })
            .select('-_id -__v -week')
            .sort({ day: 1, period: 1 })

        if (!lessons.length) return res.status(404).json({ success: false, data: 'No data found for that week (not saved)' })

        const body = { success: true, lessons }
        cache.set(cacheKey, body, TTL)
        return res.json(body)
    } catch (err) {
        console.error(`Error fetching specific week (${week}) for classroom ${classroom}: ${err}`)
        return res.status(500).json({ success: false, data: 'Internal Server Error' })
    }
})

export default router