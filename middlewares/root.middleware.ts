
import type { Request, Response, NextFunction } from "express"
import getClientIp from "@/util/realip.ts"

import { SESSION_COOKIE, getSession, touchSession, SESSION_TTL } from "@/services/session.service.ts"

interface AuthRequest extends Request {
    user?: any
}

async function root(req: AuthRequest, res: Response, next: NextFunction) {
    const token = req.cookies?.[SESSION_COOKIE]

    res.locals.user = { loggedIn: false }

    if (token) {
        try {
            // set locals with user data (displayed in /)
            const session = await getSession(token)

            if (!session) {
                res.clearCookie(SESSION_COOKIE)
            } else {
                const user = session.user
                const roles = user.roles ?? []

                req.user = {
                    ...user,
                    permissions: roles.flatMap((r: any) => r.permissions)
                }

                res.locals.user = {
                    id: user._id,
                    name: user.username,
                    roles: roles.map((r: any) => r.name),
                    permissions: req.user.permissions,
                    loggedIn: true,
                    favoriteNumber: user.favoriteNumber
                }

                // sliding expiry - only once the session is past half it's lifetime
                if (new Date(session.expiresAt).getTime() - Date.now() < SESSION_TTL / 2) {
                    touchSession(session._id).catch(err => console.error(`Failed to extend session: ${err}`))
                }
            }
        } catch (err) {
            console.error(`Session authentication error: ${err}`)
            res.clearCookie(SESSION_COOKIE)
        }
    }

    const ogStatus = res.status.bind(res)
    res.status = (code: number) => {
        res.locals.httpStatus = code
        return ogStatus(code)
    }

    res.locals.httpStatus = res.statusCode
    res.locals.dType = ""

    // debug
    res.on("finish", () => {
        console.debug(`(${res.locals.user?.name ?? "guest"}) ${getClientIp(req)} | ${req.method} ${res.statusCode} ${req.originalUrl}`)
    })

    next()
}

export { root }
