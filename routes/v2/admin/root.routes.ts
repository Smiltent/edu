
import { userAuth, requirePermission } from "@/middlewares/auth.middleware.ts"
import { scraper, express } from "@/index.ts"

import { Router } from 'express'
const router = Router()

router.post(`/refreshDatabase`, userAuth, requirePermission('admin'), (_req, res) => {
    console.warn("Manual database refresh from panel")

    scraper.reparseAllWeeksInDatabase()

    res.redirect('/admin')
})

router.post(`/refreshWeeks`, userAuth, requirePermission('admin'), (_req, res) => {
    console.warn("Manual week refresh from panel")

    scraper.storeAllWeeksToDatabase()

    res.redirect('/admin')
})

router.post(`/sendTestNotification`, userAuth, requirePermission('admin'), (_req, res) => {
    console.warn("Manual test notification sent from panel")

    express.sendWSMessage(JSON.stringify({
        week: scraper.currentWeek,
        type: "test",
        changes: [
            { day: "Pirmdiena", period: 1, from: "Subject A", to: "Subject B", class: "all", teachers: ["all"], classroom: "all" },
            { day: "Otrdiena", period: 3, from: "Subject C", to: "Subject D", class: "all", teachers: ["all"], classroom: "all" }
        ]
    }))

    res.redirect('/admin')
})

router.post(`/sendSpecificTestNotification`, userAuth, requirePermission('admin'), (req, res) => {
    const { week, clazz, type } = req.body
    console.warn("Manual test notification sent from panel")

    express.sendWSMessage(JSON.stringify({
        week: week,
        type,
        changes: [
            { day: "Pirmdiena", period: 1, from: "Subject A", to: "Subject B", class: String(clazz), teachers: [], classroom: "" }
        ]
    }))

    res.redirect('/admin')
})

export default router