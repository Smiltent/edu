
import { userAuth, requirePermission } from "@/middlewares/auth.middleware.ts"
import { countPushSubscriptions, isPushReady } from "@/services/push.service.ts"

import { Router } from 'express'
const router = Router()

// ===========================================================
router.get('/', userAuth, requirePermission('admin'), async (_req, res) => {
    res.render("admin/index", {
        pushReady: isPushReady(),
        pushSubs: await countPushSubscriptions()
    })
})

export default router
