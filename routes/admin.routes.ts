
import { userAuth, requirePermission } from "@/middlewares/auth.middleware.ts"

import { Router } from 'express'
const router = Router()

// ===========================================================
router.get('/', userAuth, requirePermission('admin'), (_, res) => {
    res.render("admin/index")
})

export default router