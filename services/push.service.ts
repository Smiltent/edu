
import webpush from "web-push"
import process from "node:process"
import PushSubscription from "@/models/PushSubscription.ts"

export type SubjectChange = {
    day: string
    period: number
    from: string
    to: string
    class: string
    teachers?: string[]
    classroom?: string
}

export type NotifyPayload = {
    week: string
    type: string
    changes: SubjectChange[]
}

let ready = false

export function initPush() {
    const publicKey = process.env.VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject = process.env.VAPID_SUBJECT || "mailto:admin@localhost"

    if (!publicKey || !privateKey) {
        console.warn("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY missing — web push disabled")
        ready = false
        return false
    }

    webpush.setVapidDetails(subject, publicKey, privateKey)
    ready = true
    console.info("Web push enabled")
    return true
}

export function isPushReady() {
    return ready
}

export function getVapidPublicKey() {
    return ready ? (process.env.VAPID_PUBLIC_KEY ?? null) : null
}

function formatChanges(changes: SubjectChange[]) {
    return changes.map(c => `${c.day} #${c.period} | ${c.from} -> ${c.to}`).join("\n")
}

function matchesFilter(change: SubjectChange, filterType: string, filterValue: string) {
    if (filterType === "class") return change.class === filterValue
    if (filterType === "teacher") return (change.teachers ?? []).includes(filterValue)
    if (filterType === "classroom") return change.classroom === filterValue
    return false
}

function lookupUrl(filterType: string, filterValue: string) {
    if (filterType === "class") return `/class?class=${encodeURIComponent(filterValue)}`
    if (filterType === "teacher") return `/teacher?teacher=${encodeURIComponent(filterValue)}`
    if (filterType === "classroom") return `/classroom?classroom=${encodeURIComponent(filterValue)}`
    return "/"
}

/**
 * Send web push to stored subscriptions matching the payload.
 * @returns number of successful deliveries
 */
export async function sendPushForChanges(payload: NotifyPayload) {
    if (!ready) return 0
    if (!payload.changes?.length) return 0

    const subs = await PushSubscription.find({}).lean()
    if (!subs.length) return 0

    let sent = 0

    await Promise.all(subs.map(async (sub) => {
        const matched = payload.type === "test"
            ? payload.changes
            : payload.changes.filter(c => matchesFilter(c, sub.filterType, sub.filterValue))

        if (!matched.length) return

        const body = JSON.stringify({
            title: sub.filterValue,
            body: formatChanges(matched),
            url: lookupUrl(sub.filterType, sub.filterValue)
        })

        try {
            if (!sub.keys?.p256dh || !sub.keys?.auth) return

            await webpush.sendNotification({
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.keys.p256dh,
                    auth: sub.keys.auth
                }
            }, body)

            sent++
        } catch (err: any) {
            const status = err?.statusCode
            if (status === 404 || status === 410) {
                await PushSubscription.deleteOne({ endpoint: sub.endpoint })
                console.info(`Removed expired push subscription`)
            } else {
                console.error(`Web push failed: ${err?.message ?? err}`)
            }
        }
    }))

    console.info(`Web push delivered to ${sent}/${subs.length} subscription(s)`)
    return sent
}

export async function countPushSubscriptions() {
    return PushSubscription.countDocuments()
}
