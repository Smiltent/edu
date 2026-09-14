
import path from "node:path"
import fs from "node:fs"

const DIR = path.join(import.meta.dirname!, '..', 'public', 'translations')

export const LANG_COOKIE = "lang"
export const LANG_TTL = 365 * 24 * 60 * 60 * 1000
export const DEFAULT_LANG = "lv"

type Dict = Record<string, string>

const translations: Record<string, Dict> = {}
const mtimes: Record<string, number> = {}

function loadTranslations() {
    for (const file of fs.readdirSync(DIR).filter(f => f.endsWith(".json"))) {
        const lang = path.basename(file, ".json")
        const fullPath = path.join(DIR, file)
        const mtime = fs.statSync(fullPath).mtimeMs

        if (mtimes[lang] === mtime && translations[lang]) continue

        try {
            translations[lang] = JSON.parse(fs.readFileSync(fullPath, "utf-8"))
            mtimes[lang] = mtime
            console.debug(`Loaded translation ${lang} (${Object.keys(translations[lang]!).length} keys)`)
        } catch (err) {
            console.error(`Failed to load translation ${file}: ${err}`)
        }
    }
}

loadTranslations()

export function LANGS(): string[] {
    loadTranslations()
    return Object.keys(translations).sort()
}

export function isLang(lang: unknown): lang is string {
    loadTranslations()
    return typeof lang === "string" && Object.hasOwn(translations, lang)
}

export function dictionary(lang: string): Dict {
    loadTranslations()
    return translations[lang] ?? translations[DEFAULT_LANG] ?? {}
}

/**
 * Translate a key, falling back to the default language and then to the key
 * itself - a missing string should never blank out the page
 * @param lang language to translate into
 * @param key translation key, eg. "lookup.class"
 * @param vars values for %placeholders% inside the string
 */
export function t(lang: string, key: string, vars?: Record<string, string | number>): string {
    loadTranslations()

    let text = translations[lang]?.[key] ?? translations[DEFAULT_LANG]?.[key] ?? key

    if (vars) {
        for (const [name, value] of Object.entries(vars)) {
            text = text.replaceAll(`%${name}%`, String(value))
        }
    }

    return text
}

export function fromHeader(header?: string): string {
    if (!header) return DEFAULT_LANG

    const wanted = header
        .split(",")
        .map(part => {
            const [tag, ...params] = part.trim().split(";")
            const q = params.find(p => p.trim().startsWith("q="))

            return {
                tag: (tag ?? "").trim().toLowerCase(),
                q: q ? Number(q.split("=")[1]) || 0 : 1
            }
        })
        .filter(l => l.tag)
        .sort((a, b) => b.q - a.q)

    for (const { tag } of wanted) {
        const base = tag.split("-")[0]!

        if (isLang(tag)) return tag
        if (isLang(base)) return base
    }

    return DEFAULT_LANG
}
