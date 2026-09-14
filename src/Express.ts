
import registerRoutes from './express/registerRoutes.ts'
import { root } from '@/middlewares/root.middleware.ts'
import expressLayouts from 'express-ejs-layouts'
import cookieParser from 'cookie-parser'
import getGitInfo from '@/util/githash.ts'
import { WebSocketServer, WebSocket } from 'ws'
import bodyParser from 'body-parser'
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import http from 'node:http'
import process from 'node:process'

export default class WebServer {
    private app: express.Express
    private wss: WebSocketServer

    private server: http.Server
    private port: string | number

    constructor(port: string) {
        console.debug("Running a new Express.ts instance...")

        this.port = port
        this.app = express()
        this.server = http.createServer(this.app)
        this.wss = new WebSocketServer({ noServer: true })

        this.i()
    }

    private async i() {
        await this.express() 
        await this.routes()
        this.ws()

        this.start()
    }

    // ================= EXPRESS =================
    private async express() {
        const isDev = process.env.ENV === 'dev'
        this.app.use(
            '/public',
            express.static(
                path.join(import.meta.dirname!, '..', 'public'), {
                    etag: !isDev,
                    lastModified: !isDev,
                    maxAge: isDev ? 0 : '10s',
                }
            )
        )
        this.app.set("view engine", "ejs")
        this.app.set("layout", "components/$layout")
        this.app.use(expressLayouts)

        this.app.set("trust proxy", [
            "loopback",
            "linklocal",
            "uniquelocal"
        ])

        this.app.use(bodyParser.urlencoded({ extended: true }))
        this.app.use(cookieParser())
        this.app.use(express.json())
        this.app.use(cors())
        
        this.app.use(root)

        if (process.env.TRACKING_CODE !== "0") {
            this.app.locals.tracking = process.env.TRACKING_CODE
        } else {
            this.app.locals.tracking = ""
        }

        const gitInfo = await getGitInfo()
        this.app.locals.gitHash = gitInfo.hash
        this.app.locals.gitUrl = gitInfo.url
    }

    // ================= API =================
    private async routes() {
        await registerRoutes(this.app)

        this.app.use((_req, res) => {
            res.status(404).render("error")
        })
    }
    
    // ================= WEBSOCKETS =================
    private ws() {
        const PING_MS = 30_000

        this.wss.on('connection', (ws) => {
            console.info(`WS client connected (${this.wss.clients.size} total)`)

            ;(ws as WebSocket & { isAlive?: boolean }).isAlive = true
            ws.on('pong', () => {
                ;(ws as WebSocket & { isAlive?: boolean }).isAlive = true
            })

            ws.on('error', (err) => console.error(`WebSocket client error: ${err}`))
            ws.on('close', () => console.info(`WS client disconnected (${this.wss.clients.size} total)`))
        })

        const pingTimer = setInterval(() => {
            this.wss.clients.forEach(c => {
                const client = c as WebSocket & { isAlive?: boolean }
                if (client.isAlive === false) return client.terminate()

                client.isAlive = false
                if (client.readyState === WebSocket.OPEN) client.ping()
            })
        }, PING_MS)

        this.wss.on('close', () => clearInterval(pingTimer))

        this.server.on('upgrade', (req, soc, head) => {
            const url = (req.url ?? '').split('?')[0]

            if (url !== '/v1/ws') {
                soc.write('HTTP/1.1 404 Not Found\r\n\r\n')
                return soc.destroy()
            }

            this.wss.handleUpgrade(req, soc, head, (ws) => this.wss.emit('connection', ws, req))
        })
    }

    public sendWSMessage(msg: string) {
        let sent = 0

        this.wss.clients.forEach(c => {
            if (c.readyState !== WebSocket.OPEN) return

            try {
                c.send(msg)
                sent++
            } catch (err) {
                console.error(`Failed sending WS message to a client: ${err}`)
            }
        })

        console.info(`WS broadcast to ${sent}/${this.wss.clients.size} client(s): ${msg}`)
        return sent
    }

    public getWSClientCount() {
        let open = 0
        this.wss.clients.forEach(c => {
            if (c.readyState === WebSocket.OPEN) open++
        })
        return open
    }

    private start() {
        this.server.listen(this.port, () => console.info(`Starting HTTP server on http://0.0.0.0:${this.port}`))
    }
}