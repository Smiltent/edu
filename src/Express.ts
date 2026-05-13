
import registerRoutes from './express/registerRoutes'
import { root } from '@/middlewares/root.middleware'
import expressLayouts from 'express-ejs-layouts'
import cookieParser from 'cookie-parser'
import getGitInfo from '@/util/githash'
import { WebSocketServer } from 'ws'
import bodyParser from 'body-parser'
import express from 'express'
import cors from 'cors'
import path from 'path'
import http from 'http'

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
        this.wss = new WebSocketServer({ server: this.server })
        
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
                path.join(__dirname, '..', 'public'), {
                    etag: !isDev,
                    lastModified: !isDev,
                    maxAge: isDev ? 0 : '10s',
                }
            )
        )
        this.app.set("view engine", "ejs")
        this.app.set("layout", "partials/$layout")
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
            
        this.app.locals.metaUrl = process.env.META_URL || "https://example.com"
        this.app.locals.metaTitle = process.env.META_TITLE || "School Name"

        const gitInfo = await getGitInfo()
        this.app.locals.gitHash = gitInfo.hash
        this.app.locals.gitUrl = gitInfo.url
    }

    // ================= API =================
    private async routes() {
        await registerRoutes(this.app)

        this.app.use((req, res) => {
            res.status(404).render("error")
        })
    }
    
    // ================= WEBSOCKETS =================
    private ws() {
        this.wss.on('connection', (ws, req) => {
            console.debug('New Client connected')

            ws.on('close', () => console.debug('Client disconnected'))
        })

        this.server.on('upgrade', (req, soc, head) => {
            const { url } = req

            if (url !== '/v1/ws') return soc.destroy()
        })
    }

    public sendWSMessage(msg: string) { 
        console.debug(`Sent WS message: ${msg}`)
        this.wss.clients.forEach(c => c.send(msg)) 
    }

    private start() {
        this.server.listen(this.port, () => console.info(`Starting HTTP server on http://0.0.0.0:${this.port}`))
    }
}