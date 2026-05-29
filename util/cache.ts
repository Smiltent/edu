
type Entry = { value: any; expiresAt: number }

class SimpleCache {
    private store = new Map<string, Entry>()

    set(key: string, value: any, ttlMs: number) {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
    }

    get(key: string): any | null {
        const entry = this.store.get(key)
        if (!entry) return null
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key)
            return null
        }
        return entry.value
    }

    invalidate(prefix?: string) {
        if (!prefix) {
            this.store.clear()
            return
        }
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) this.store.delete(key)
        }
    }
}

export default new SimpleCache()
