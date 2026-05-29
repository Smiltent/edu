
// ================= IMPORTS =================
import Database from "./src/Mongo.ts"
import Express from "./src/Express.ts"
import Scraper from "./src/Scraper.ts"

import logging from "./util/log.ts"

// ================= ARGUMENTS =================
import args from "./util/args.ts"
const argDEBUG = args("--debug", "-d")
logging(argDEBUG)

// ================= MAIN ================= 
export let scraper: Scraper
export let express: Express
async function main() {
    const db = new Database(process.env.CONNECTION_STRING!)
    await db.ready

    scraper = new Scraper(process.env.WEBSITE_URL!)
    express = new Express(process.env.PORT! || "3000")
}

main()