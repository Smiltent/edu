
import { type Application } from 'express'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

async function registerRoutesInDir(app: Application, dir: string, baseMount: string = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    const files = entries.filter(e => e.isFile() && e.name.endsWith(".routes.ts"))
    for (const file of files) {
        const fPath = path.join(dir, file.name)

        const name = path.basename(file.name)
            .replace(/\.routes.ts$/, "")
            .replace(".", "/")

        const mount = name === "root" ? baseMount || "/" : `${baseMount}/${name}`

        try {
            const mod = await import(pathToFileURL(fPath).href)
            const router = mod.default

            if (!router || typeof router !== "function") {
                console.debug(`Skipping ${file.name} - no default export!`)
                continue
            }

            app.use(mount, router)
            console.debug(`Mounted ${file.name} -> ${mount}`)
        } catch (err) {
            console.error(`Failed to load ${file.name}: ${err}`)
        }
    }

    const subDirs = entries.filter(e => e.isDirectory())
    for (const subDir of subDirs) {
        const subdirPath = path.join(dir, subDir.name)
        await registerRoutesInDir(app, subdirPath, `${baseMount}/${subDir.name}`)
    }
}

export default async function registerRoutes(app: Application) {
    const dir = path.join(import.meta.dirname!, '..', '..', 'routes')
    await registerRoutesInDir(app, dir)
}
