
import { execFileSync } from 'node:child_process'

export default async function getGitInfo() {
    try {
        // spawned without a shell, so the runtime only has to be allowed to run git itself
        const hash = execFileSync("git", ["rev-parse", "HEAD"]).toString().trim()

        return {
            hash: hash.substring(0, 14),
            url: `https://git.smilt.dev/smil/edu/commit/${hash}`
        }
    } catch (err) {
        console.error(`Error fetching git hash from .git folder (git might not be installed): ${err}`)
        return {
            hash: "unknown",
            url: "#"
        }
    }
}
