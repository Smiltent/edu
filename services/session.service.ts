
import crypto from "node:crypto"
import process from "node:process"

import Session from "@/models/Session.ts"

export const SESSION_COOKIE = "sid"

const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS) || 7
export const SESSION_TTL = TTL_DAYS * 24 * 60 * 60 * 1000

interface SessionMeta {
    userAgent?: string,
    ip?: string
}

function hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex")
}

async function createSession(userId: unknown, meta: SessionMeta = {}) {
    const token = crypto.randomBytes(32).toString("hex")

    await Session.create({
        token: hashToken(token),
        user: userId,
        userAgent: meta.userAgent ?? "unknown",
        ip: meta.ip ?? "unknown",
        expiresAt: new Date(Date.now() + SESSION_TTL)
    })

    return token
}

async function getSession(token: string) {
    const session: any = await Session.findOne({ token: hashToken(token) })
        .populate({ path: "user", populate: { path: "roles" } })
        .lean()

    if (!session) return null

    if (!session.user || new Date(session.expiresAt).getTime() < Date.now()) {
        await Session.deleteOne({ _id: session._id })
        return null
    }

    return session
}

async function touchSession(sessionId: unknown) {
    await Session.updateOne(
        { _id: sessionId },
        { $set: { expiresAt: new Date(Date.now() + SESSION_TTL) } }
    )
}

async function destroySession(token: string) {
    await Session.deleteOne({ token: hashToken(token) })
}

async function destroyUserSessions(userId: unknown) {
    await Session.deleteMany({ user: userId })
}

export { createSession, getSession, touchSession, destroySession, destroyUserSessions }
