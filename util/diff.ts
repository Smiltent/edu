
export function hasChanges(oldd: unknown, neww: unknown): boolean {
    if (oldd === neww) return false
    if (oldd == null || neww == null) return true

    return JSON.stringify(oldd) !== JSON.stringify(neww)
}
