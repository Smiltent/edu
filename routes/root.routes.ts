
import { SESSION_COOKIE, SESSION_TTL, destroySession } from "../services/session.service.ts"
import { register, login } from "../services/auth.service.ts"
import { userAuth } from "../middlewares/auth.middleware.ts"
import { LANG_COOKIE, LANG_TTL, isLang } from "../util/i18n.ts"
import { times, timesWeekend } from "../util/time.ts"
import getClientIp from "../util/realip.ts"
import rateLimit from "express-rate-limit"

import { Router } from 'express'
import process from "node:process"
import path from "node:path"

const router = Router()

const PUBLIC = path.join(import.meta.dirname!, '..', 'public')

const COOKIE = {
    httpOnly: true,
    secure: process.env.ENV === 'prod',
    sameSite: 'strict' as const,
    maxAge: SESSION_TTL
}

const LOGIN_REGISTER_RATELIMIT = rateLimit({
    windowMs: 20 * 60 * 1000, // 20 minlog
    limit: 10,
    handler: (req, res) => {
        switch (req.path) {
            case '/login':
                return res.status(429).render("login", { dMsg: "you are being ratelimited", dType: "bad" } )

            case '/register':
                return res.status(429).render("register", { dMsg: "you are being ratelimited", dType: "bad" } )

            default:
                return res.status(429).json({ error: "You are being ratelimited. Try again later!"})
        }
    }
})

// ===========================================================
router.post('/register', LOGIN_REGISTER_RATELIMIT, async (req, res) => {
    if (process.env.REGISTER == "false") return res.status(400).render("register", { dMsg: "registering is disabled", dType: "bad" } )
    if (req.user) return res.redirect('/')

    try {
        const { username, password, favoriteNumber } = req.body

        // validate
        if (typeof password !== 'string' || typeof username !== 'string') return res.status(400).render("register", { dMsg: "no.", dType: "bad" } )

        if (username.length < 3 || username.length > 20) return res.status(400).render("register", { dMsg: "username must be between 3 and 20 characters", dType: "bad" } )
        if (username.match(/[^a-zA-Z0-9_]/)) return res.status(400).render("register", { dMsg: "username may only contain letters, numbers and underscores", dType: "bad" } )

        const number = Number(favoriteNumber)
        if (favoriteNumber === undefined || favoriteNumber === "" || isNaN(number) || number < 0 || number > 100) return res.status(400).render("register", { dMsg: "favorite number must be a number between 0 and 100", dType: "bad" } )

        if (password.length < 6 || password.length > 64) return res.status(400).render("register", { dMsg: "password must be between 6 and 64 characters", dType: "bad" } )

        await register(username, password, number)

        res.render("login", { dMsg: "you have registered. please log in!", dType: "good"} )
    } catch (err: any) {
        res.status(400).render("register", { dMsg: err.message, dType: "bad" } )
    }
})

router.get('/register', (req, res) => {
    if (req.user) return res.redirect('/')
    res.render("register")
})

// ===========================================================
router.post('/login', LOGIN_REGISTER_RATELIMIT, async (req, res) => {
    if (req.user) return res.redirect('/')

    try {
        const { username, password } = req.body
        if (typeof password !== 'string' || typeof username !== 'string') return res.status(400).render("login", { dMsg: "no.", dType: "bad" } )

        const token = await login(username, password, {
            userAgent: req.get("user-agent") ?? "unknown",
            ip: String(getClientIp(req) ?? "unknown")
        })

        res.cookie(SESSION_COOKIE, token, COOKIE)
        res.redirect('/')
    } catch (err: any) {
        res.status(400).render("login", { dMsg: err.message, dType: "bad" } )
    }
})

router.get('/login', (req, res) => {
    if (req.user) return res.redirect('/')
    res.render("login")
})

// ===========================================================
router.get('/logout', userAuth, async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE]
    if (token) await destroySession(token)

    res.clearCookie(SESSION_COOKIE)
    res.redirect('/')
})

// ===========================================================
router.get('/lang/:lang', (req, res) => {
    const lang = req.params.lang

    if (isLang(lang)) {
        res.cookie(LANG_COOKIE, lang, {
            httpOnly: false,
            secure: process.env.ENV === 'prod',
            sameSite: 'lax' as const,
            maxAge: LANG_TTL
        })
    }

    // only ever bounce back somewhere on this site
    const back = String(req.query.back ?? '/')
    res.redirect(back.startsWith('/') && !back.startsWith('//') ? back : '/')
})

// ===========================================================
router.get('/class', (_, res) => {
    res.render("lookup/class")
})

router.get('/classroom', (_, res) => {
    res.render("lookup/classroom")
})

router.get('/teacher', (_, res) => {
    res.render("lookup/teacher")
})

// ===========================================================
router.get('/times', (_, res) => {
    res.render("times", { times, timesWeekend })
})

router.get('/', (_, res) => {
    res.render("index")
})

router.get('/favicon.ico', (_, res) => {
    res.sendFile(path.join(PUBLIC, 'favicon.ico'))
})

router.get('/sw.js', (_, res) => {
    res.set("Service-Worker-Allowed", "/")
    res.set("Cache-Control", "no-cache")
    res.type("application/javascript").sendFile(path.join(PUBLIC, 'sw.js'))
})

router.get('/site.webmanifest', (_, res) => {
    res.type('application/manifest+json').sendFile(path.join(PUBLIC, 'site.webmanifest'))
})

router.get('/teapot', (_, res) => {
    res.status(418).render("error")
})

export default router
