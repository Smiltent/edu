
import SubjectRemap from '@/models/SubjectRemap.ts'
import Lesson from '@/models/Lesson.ts'

export type RemapRule = {
    _id?: any
    enabled: boolean
    match: {
        classes: string[]
        groups: string[]
        teachers: string[]
        name: string
    }
    toName: string
}

export type RemapContext = {
    class: string
    group: string
    teachers: string[]
}

function normalizeList(value: any): string[] {
    if (!Array.isArray(value)) return []
    return value.map((v) => String(v).trim()).filter(Boolean)
}

export function normalizeRule(raw: any): RemapRule {
    return {
        _id: raw._id,
        enabled: raw.enabled !== false,
        match: {
            classes: normalizeList(raw.match?.classes),
            groups: normalizeList(raw.match?.groups),
            teachers: normalizeList(raw.match?.teachers),
            name: String(raw.match?.name ?? '').trim()
        },
        toName: String(raw.toName ?? '').trim()
    }
}

function listMatches(required: string[], actual: string | string[]): boolean {
    if (!required.length) return true
    const values = Array.isArray(actual) ? actual.map(String) : [String(actual)]
    return required.some((r) => values.includes(r))
}

function teachersMatch(required: string[], actual: string[]): boolean {
    if (!required.length) return true
    const set = new Set((actual ?? []).map(String))
    return required.every((t) => set.has(t))
}

export function ruleMatches(rule: RemapRule, ctx: RemapContext, subjectName: string): boolean {
    if (!rule.enabled) return false
    if (!rule.match.name || subjectName !== rule.match.name) return false
    if (!listMatches(rule.match.classes, ctx.class)) return false
    if (!listMatches(rule.match.groups, ctx.group)) return false
    if (!teachersMatch(rule.match.teachers, ctx.teachers)) return false
    return true
}

/**
 * Apply the first matching remap rule to a scraped subject name.
 */
export function applySubjectRemap(name: string, ctx: RemapContext, rules: RemapRule[]): string {
    for (const rule of rules) {
        if (ruleMatches(rule, ctx, name)) return rule.toName
    }
    return name
}

/**
 * True when a name diff is only the silent backend remap (should not notify / record changes).
 */
export function isSilentSubjectRemap(
    from: string,
    to: string,
    ctx: RemapContext,
    rules: RemapRule[]
): boolean {
    if (!from || !to || from === to) return false
    return rules.some((rule) =>
        rule.enabled
        && rule.match.name === from
        && rule.toName === to
        && ruleMatches(rule, ctx, from)
    )
}

let cachedRules: RemapRule[] | null = null
let cachedAt = 0
const RULES_TTL_MS = 30_000

export function invalidateSubjectRemapCache() {
    cachedRules = null
    cachedAt = 0
}

export async function loadEnabledRemapRules(force = false): Promise<RemapRule[]> {
    if (!force && cachedRules && Date.now() - cachedAt < RULES_TTL_MS) {
        return cachedRules
    }

    const docs = await SubjectRemap.find({ enabled: true }).lean()
    cachedRules = docs.map(normalizeRule).filter((r) => r.match.name && r.toName)
    cachedAt = Date.now()
    return cachedRules
}

/**
 * Silently rewrite stored lesson names for a rule (no changes history, no notifications).
 */
export async function applyRemapToExistingLessons(rule: RemapRule): Promise<number> {
    if (!rule.enabled || !rule.match.name || !rule.toName) return 0
    if (rule.match.name === rule.toName) return 0

    const filter: Record<string, any> = {
        name: rule.match.name,
        'adminOverride.active': { $ne: true }
    }

    if (rule.match.classes.length) filter.class = { $in: rule.match.classes }
    if (rule.match.groups.length) filter.group = { $in: rule.match.groups }
    if (rule.match.teachers.length) {
        // every listed teacher must be present on the lesson
        filter.teachers = { $all: rule.match.teachers }
    }

    const result = await Lesson.updateMany(filter, { $set: { name: rule.toName } })
    return result.modifiedCount ?? 0
}
