
import process from "node:process"
import chalk from "chalk"
import path from "node:path"

const YELLOW = chalk.bgHex("#ebc415")
const ORANGE = chalk.bgHex("#f05e0a")
const BLUE = chalk.bgHex("#1e66f5")
const GRAY = chalk.hex("#232634")
const RED = chalk.bgHex("#d20f39")

/**
 * Get the current time in a specific format
 * @returns Current time in HH:MM:SS:MS format
 */
function getTime() {
    const date = new Date()

    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    const seconds = String(date.getSeconds()).padStart(2, '0')
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0')

    return `${hours}:${minutes}:${seconds}.${milliseconds}`
}

/**
 * Extract the caller file from the stack trace
 */
function getCaller() {
    const stack = new Error().stack
    if (!stack) return "unknown"

    const lines = stack.split("\n")

    const callerLine = lines[3]
    if (!callerLine) return "unknown"

    const match =
        callerLine.match(/\((.*):(\d+):(\d+)\)/) ||
        callerLine.match(/at (.*):(\d+):(\d+)/)

    if (!match) return "unknown"

    const filePath = match[1] ?? "?"
    const line = match[2]

    return `${path.basename(filePath)}:${line}`
}

export default function log(debug: boolean) {
    const base = (level: string, ...args: any[]) => {
        const caller = getCaller()

        const body = args.map(a =>
            typeof a === "string" ? a : Deno.inspect(a, { colors: true, depth: 4 })
        ).join(" ")

        process.stdout.write(
            `${level}${GRAY(` [${caller}] ${getTime()} `)} ${body}\n`
        )
    }

    console.log = (...args) => base("", ...args)
    console.warn = (...args) => base(`${YELLOW(" warn ")}`, ...args)
    console.error = (...args) => base(`${RED(" error ")}`, ...args)
    console.info = (...args) => base(`${BLUE(" info ")}`, ...args)

    debug ? console.debug = (...args) => base(`${ORANGE(" debug ")}`, ...args) : console.debug = () => {}
    console.debug("Debug mode is enabled")
}
