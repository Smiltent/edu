
import process from "node:process"

export default function args(...string: string[]) {
    var out = false
    string.forEach(i => {
        if (process.argv.includes(i)) {
            out = true
        }
    })

    return out
}