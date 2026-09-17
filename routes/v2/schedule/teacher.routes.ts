
import { getWeekDoc, getCurrentWeekDoc, TTL } from '@/util/weeks.ts'
import Lesson from '@/models/Lesson.ts'
import cache from '@/util/cache.ts'

import { Router } from 'express'
const router = Router()

router.get('/list', async (_, res) => {
    try {
        const hit = cache.get('teacher-list')
        if (hit) return res.json(hit)

        const weekDoc = await getCurrentWeekDoc()
        const data = weekDoc ? await Lesson.distinct('teachers', { week: weekDoc._id, removed: { $ne: true } }) : []

        const body = { success: true, data }
        cache.set('teacher-list', body, TTL)
        return res.json(body)
    } catch (err) {
        console.error(`Error listing all teacher names: ${err}`)
        return res.status(500).json({ success: false, data: 'Internal Server Error' })
    }
})

router.get('/:teacher/week/:week', async (req, res) => {
    const { teacher, week } = req.params
    if (!teacher) return res.status(400).json({ success: false, data: 'Missing teacher' })
    if (!week) return res.status(400).json({ success: false, data: 'Missing week number' })

    try {
        const cacheKey = `teacher-${week}-${teacher}`
        const hit = cache.get(cacheKey)
        if (hit) return res.json(hit)

        const weekDoc = await getWeekDoc(week)
        if (!weekDoc) return res.status(404).json({ success: false, data: 'Week not found' })

        const lessons = await Lesson.find({ week: weekDoc._id, teachers: teacher, removed: { $ne: true } })
            .select('-__v -week')
            .sort({ day: 1, period: 1 })

        if (!lessons.length) return res.status(404).json({ success: false, data: 'No data found for that week (not saved)' })

        const body = { success: true, lessons }
        cache.set(cacheKey, body, TTL)
        return res.json(body)
    } catch (err) {
        console.error(`Error fetching specific week (${week}) for ${teacher}: ${err}`)
        return res.status(500).json({ success: false, data: 'Internal Server Error' })
    }
})

export default router