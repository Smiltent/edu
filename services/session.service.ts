
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

/**
 * The raw cookie value never touches the database, only it's hash does.
 * @param token Raw session token
 * @returns The hash stored in the database
 */
function hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex")
}

/**
 * Creates a new session for a user
 * @param userId The user the session belongs to
 * @param meta Optional request information, used to tell sessions apart
 * @returns The raw token, meant to be stored inside the cookie
 */
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

/**
 * Resolves a raw token into it's session, with the user and roles attached
 * @param token Raw session token from the cookie
 * @returns The session || null if it's invalid or expired
 */
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

/**
 * Pushes the expiry of a session further away, so active users don't get logged out
 * @param sessionId The session to extend
 */
async function touchSession(sessionId: unknown) {
    await Session.updateOne(
        { _id: sessionId },
        { $set: { expiresAt: new Date(Date.now() + SESSION_TTL) } }
    )
}

/**
 * Removes a single session
 * @param token Raw session token from the cookie
 */
async function destroySession(token: string) {
    await Session.deleteOne({ token: hashToken(token) })
}

/**
 * Removes every session of a user, used when the account changes or disappears
 * @param userId The user to log out everywhere
 */
async function destroyUserSessions(userId: unknown) {
    await Session.deleteMany({ user: userId })
}

export { createSession, getSession, touchSession, destroySession, destroyUserSessions }
