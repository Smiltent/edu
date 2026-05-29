
import Week from '@/models/Week'
import cache from '@/util/cache'

import { scraper } from '@/index'
import { Router } from 'express'
const router = Router()

const TTL = 5 * 60 * 1000

router.get('/list', async (_, res) => {
    try {
        const hit = cache.get('weeks-list')
        if (hit) return res.json({ ...hit, currentWeek: scraper.currentWeek })

        const weeks = await Week.find().select('id year dateFrom days -_id').sort({ dateFrom: 1 })

        const body = { success: true, data: weeks }
        cache.set('weeks-list', body, TTL)
        return res.json({ ...body, currentWeek: scraper.currentWeek })
    } catch (err) {
        console.error(`Error listing weeks: ${err}`)
        return res.status(500).json({ success: false, data: 'Internal Server Error' })
    }
})

export default router