
import type { Request, Response, NextFunction } from "express"

declare global {
    namespace Express {
        interface Request {
            user?: any
        }
    }
}

interface AuthRequest extends Request {
    user?: any
}

/**
 * The session is already resolved by root.middleware, this only gates the route
 */
function userAuth(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user) {
        if (wantsJson(req)) return res.status(401).json({ success: false, error: 'Unauthorized' })
        return res.status(401).render("error")
    }

    return next()
}

function wantsJson(req: Request) {
    const accept = req.get('accept') || ''
    return accept.includes('application/json') || req.path.startsWith('/v2/') || req.originalUrl.startsWith('/v2/')
}

/**
 * Check if a user has valid permissions, continue if they match
 * @param permissions permissions, might require multiple?
 * @returns if they can continue
 */
function requirePermission(...permissions: string[]) {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            if (wantsJson(req)) return res.status(401).json({ success: false, error: 'Unauthorized' })
            return res.status(401).render("error")
        }

        const userPermissions = new Set(req.user.permissions)

        const hasPerm = permissions.some(p => userPermissions.has(p))
        if (!hasPerm) {
            if (wantsJson(req)) return res.status(403).json({ success: false, error: 'Forbidden' })
            return res.status(403).render("error")
        }

        return next()
    }
}

export { userAuth, requirePermission }
