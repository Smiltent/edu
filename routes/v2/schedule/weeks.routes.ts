
import { getCurrentWeekDoc, TTL } from '@/util/weeks.ts'
import Week from '@/models/Week.ts'
import cache from '@/util/cache.ts'

import { Router } from 'express'
const router = Router()

router.get('/list', async (_, res) => {
    try {
        const currentWeek = (await getCurrentWeekDoc())?.id ?? "0"

        const hit = cache.get('weeks-list')
        if (hit) return res.json({ ...hit, currentWeek })

        const weeks = await Week.find().select('id year dateFrom days -_id').sort({ dateFrom: 1 }).lean()

        const body = { success: true, data: weeks }
        cache.set('weeks-list', body, TTL)
        return res.json({ ...body, currentWeek })
    } catch (err) {
        console.error(`Error listing weeks: ${err}`)
        return res.status(500).json({ success: false, data: 'Internal Server Error' })
    }
})

export default router
