
import { express } from "@/index.ts"
import { sendPushForChanges, type NotifyPayload } from "@/services/push.service.ts"

/**
 * Broadcast schedule change notifications over WebSocket (open tabs)
 * and Web Push (works with the site closed).
 */
export async function broadcastScheduleNotify(payload: NotifyPayload) {
    const wsSent = express?.sendWSMessage(JSON.stringify(payload)) ?? 0
    const pushSent = await sendPushForChanges(payload)
    return { wsSent, pushSent }
}
