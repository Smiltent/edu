
import migrations from "@/util/migrations.ts"
import mongoose from "mongoose"

export default class Database {
    public ready: Promise<void>

    constructor(uri: string) {
        this.ready = this.connect(uri)
    }

    private async connect(uri: string) {
        try {
            console.debug(`Connecting to Database...`)
            await mongoose.connect(uri, {
                maxPoolSize: 20
            })
            await migrations()

            console.info("Connected to Database!")
        } catch (err) {
            console.error(`Error connecting to Database: ${err}`)
            process.exit(1)
        }
    }
}