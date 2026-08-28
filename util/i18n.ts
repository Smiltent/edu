
import path from "node:path"
import fs from "node:fs"

const DIR = path.join(import.meta.dirname!, '..', 'public', 'translations')

export const LANG_COOKIE = "lang"
export const LANG_TTL = 365 * 24 * 60 * 60 * 1000 // a year

// what an unrecognised (or missing) Accept-Language falls back to
export const DEFAULT_LANG = "lv"

type Dict = Record<string, string>

const translations: Record<string, Dict> = {}

for (const file of fs.readdirSync(DIR).filter(f => f.endsWith(".json"))) {
    const lang = path.basename(file, ".json")

    try {
        translations[lang] = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf-8"))
        console.debug(`Loaded translation ${lang} (${Object.keys(translations[lang]!).length} keys)`)
    } catch (err) {
        console.error(`Failed to load translation ${file}: ${err}`)
    }
}

export const LANGS = Object.keys(translations).sort()

export function isLang(lang: unknown): lang is string {
    return typeof lang === "string" && Object.hasOwn(translations, lang)
}

export function dictionary(lang: string): Dict {
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
    let text = translations[lang]?.[key] ?? translations[DEFAULT_LANG]?.[key] ?? key

    if (vars) {
        for (const [name, value] of Object.entries(vars)) {
            text = text.replaceAll(`%${name}%`, String(value))
        }
    }

    return text
}

/**
 * Pick the best supported language out of an Accept-Language header
 */
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
        // "lv-LV" should still match "lv"
        const base = tag.split("-")[0]!

        if (isLang(tag)) return tag
        if (isLang(base)) return base
    }

    return DEFAULT_LANG
}
