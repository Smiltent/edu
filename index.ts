
// ================= IMPORTS =================
import Database from "./src/Mongo.ts"
import Express from "./src/Express.ts"
import Scraper from "./src/Scraper.ts"

import logging from "./util/log.ts"
import process from "node:process"

// ================= ARGUMENTS =================
logging(process.env.NODE_ENV === "dev")

// ================= MAIN ================= 
export let scraper: Scraper
export let express: Express
async function main() {
    const missing = ["CONNECTION_STRING", "WEBSITE_URL"].filter(key => !process.env[key])
    if (missing.length) {
        console.error(`Missing required environment variables: ${missing.join(", ")}`)
        process.exit(1)
    }

    const db = new Database(process.env.CONNECTION_STRING!)
    await db.ready

    express = new Express(process.env.PORT || "3000")
    scraper = new Scraper(process.env.WEBSITE_URL!)
}

main()