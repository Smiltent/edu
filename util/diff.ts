
/**
 * Checks whether two payloads differ. The old implementation built a full git-style
 * hunk diff just to be compared against "no changes", which is a lot of work for a boolean.
 * @param oldd Old data.
 * @param neww New data.
 * @returns true when the data is not identical
 */
export function hasChanges(oldd: unknown, neww: unknown): boolean {
    if (oldd === neww) return false
    if (oldd == null || neww == null) return true

    return JSON.stringify(oldd) !== JSON.stringify(neww)
}
