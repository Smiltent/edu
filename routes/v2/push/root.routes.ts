
import { Router } from "express"
import PushSubscription from "@/models/PushSubscription.ts"
import { getVapidPublicKey, isPushReady } from "@/services/push.service.ts"

const router = Router()

const FILTER_TYPES = new Set(["class", "teacher", "classroom"])

router.get("/vapidPublicKey", (_req, res) => {
    if (!isPushReady()) {
        return res.status(503).json({ success: false, error: "web push is not configured" })
    }

    res.json({ success: true, publicKey: getVapidPublicKey() })
})

router.post("/subscribe", async (req, res) => {
    if (!isPushReady()) {
        return res.status(503).json({ success: false, error: "web push is not configured" })
    }

    const { subscription, filterType, filterValue } = req.body ?? {}

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return res.status(400).json({ success: false, error: "invalid subscription" })
    }

    if (!FILTER_TYPES.has(filterType) || typeof filterValue !== "string" || !filterValue.trim()) {
        return res.status(400).json({ success: false, error: "invalid filter" })
    }

    await PushSubscription.findOneAndUpdate(
        { endpoint: subscription.endpoint },
        {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth
            },
            filterType,
            filterValue: filterValue.trim(),
            updatedAt: new Date()
        },
        { upsert: true, new: true }
    )

    res.json({ success: true })
})

router.delete("/subscribe", async (req, res) => {
    const endpoint = req.body?.endpoint
    if (typeof endpoint !== "string" || !endpoint) {
        return res.status(400).json({ success: false, error: "missing endpoint" })
    }

    await PushSubscription.deleteOne({ endpoint })
    res.json({ success: true })
})

export default router
