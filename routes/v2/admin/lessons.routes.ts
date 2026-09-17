import { userAuth, requirePermission } from "@/middlewares/auth.middleware.ts"
import Lesson from "@/models/Lesson.ts"
import cache from "@/util/cache.ts"

import { Router } from 'express'
const router = Router()

const EDITABLE = ["name", "classroom", "teachers", "lessonStart", "lessonEnd", "removed"] as const

function snapshotSource(lesson: any) {
    return {
        classroom: lesson.classroom ?? "",
        name: lesson.name ?? "",
        teachers: lesson.teachers ?? [],
        lessonStart: lesson.lessonStart ?? "",
        lessonEnd: lesson.lessonEnd ?? "",
        removed: !!lesson.removed
    }
}

function teachersEqual(a: any, b: any) {
    const left = [...(Array.isArray(a) ? a : [])].map(String).sort()
    const right = [...(Array.isArray(b) ? b : [])].map(String).sort()
    return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * PATCH /v2/admin/lessons/:id
 * Manually override lesson fields. Survives scrape/reparse until cleared.
 */
router.patch('/:id', userAuth, requirePermission('admin'), async (req, res) => {
    const { id } = req.params
    if (!id) return res.status(400).json({ success: false, error: 'Missing lesson id' })

    try {
        const lesson = await Lesson.findById(id)
        if (!lesson) return res.status(404).json({ success: false, error: 'Lesson not found' })

        const body = req.body ?? {}
        const changes: any[] = []
        const now = new Date()
        const set: Record<string, any> = {}

        if (!lesson.adminOverride?.active) {
            set['adminOverride.source'] = snapshotSource(lesson)
        }

        for (const field of EDITABLE) {
            if (body[field] === undefined) continue

            if (field === 'teachers') {
                const next = Array.isArray(body.teachers)
                    ? body.teachers.map((t: any) => String(t).trim()).filter(Boolean)
                    : String(body.teachers ?? '').split(',').map((t: string) => t.trim()).filter(Boolean)

                if (!teachersEqual(lesson.teachers, next)) {
                    changes.push({ date: now, type: 'teachers', from: lesson.teachers ?? [], to: next, by: 'admin' })
                    set.teachers = next
                }
                continue
            }

            if (field === 'removed') {
                const next = !!body.removed
                if (!!lesson.removed !== next) {
                    changes.push({ date: now, type: 'removed', from: !!lesson.removed, to: next, by: 'admin' })
                    set.removed = next
                    if (next) {
                        if (lesson.name) changes.push({ date: now, type: 'name', from: lesson.name, to: '', by: 'admin' })
                        if (lesson.classroom) changes.push({ date: now, type: 'classroom', from: lesson.classroom, to: '', by: 'admin' })
                        if ((lesson.teachers ?? []).length) changes.push({ date: now, type: 'teachers', from: lesson.teachers, to: [], by: 'admin' })
                        set.name = ''
                        set.classroom = ''
                        set.teachers = []
                    }
                }
                continue
            }

            const next = String(body[field] ?? '').trim()
            const prev = String((lesson as any)[field] ?? '')
            if (prev !== next) {
                if (field === 'lessonStart' || field === 'lessonEnd') {
                    // times are recorded as a pair once both known
                } else {
                    changes.push({ date: now, type: field, from: prev, to: next, by: 'admin' })
                }
                set[field] = next
            }
        }

        const nextStart = set.lessonStart !== undefined ? set.lessonStart : lesson.lessonStart
        const nextEnd = set.lessonEnd !== undefined ? set.lessonEnd : lesson.lessonEnd
        if (nextStart !== lesson.lessonStart || nextEnd !== lesson.lessonEnd) {
            changes.push({
                date: now,
                type: 'times',
                from: `${lesson.lessonStart}-${lesson.lessonEnd}`,
                to: `${nextStart}-${nextEnd}`,
                by: 'admin'
            })
        }

        if (!Object.keys(set).length && !changes.length) {
            return res.json({ success: true, lesson, unchanged: true })
        }

        set['adminOverride.active'] = true
        set['adminOverride.modifiedAt'] = now
        set['adminOverride.modifiedBy'] = req.user._id

        const update: any = { $set: set }
        if (changes.length) update.$push = { changes: { $each: changes } }

        const updated = await Lesson.findByIdAndUpdate(id, update, { new: true })
        cache.invalidate()

        return res.json({ success: true, lesson: updated })
    } catch (err) {
        console.error(`Error updating lesson ${id}: ${err}`)
        return res.status(500).json({ success: false, error: 'Internal Server Error' })
    }
})

/**
 * DELETE /v2/admin/lessons/:id/override
 * Restore Edupage source values and clear the site-admin override.
 */
router.delete('/:id/override', userAuth, requirePermission('admin'), async (req, res) => {
    const { id } = req.params
    if (!id) return res.status(400).json({ success: false, error: 'Missing lesson id' })

    try {
        const lesson = await Lesson.findById(id)
        if (!lesson) return res.status(404).json({ success: false, error: 'Lesson not found' })

        if (!lesson.adminOverride?.active) {
            return res.json({ success: true, lesson, unchanged: true })
        }

        const source = lesson.adminOverride.source ?? snapshotSource(lesson)
        const now = new Date()
        const changes: any[] = []

        if (lesson.name !== (source.name ?? '')) {
            changes.push({ date: now, type: 'name', from: lesson.name, to: source.name ?? '', by: 'admin' })
        }
        if (lesson.classroom !== (source.classroom ?? '')) {
            changes.push({ date: now, type: 'classroom', from: lesson.classroom, to: source.classroom ?? '', by: 'admin' })
        }
        if (!teachersEqual(lesson.teachers, source.teachers ?? [])) {
            changes.push({ date: now, type: 'teachers', from: lesson.teachers ?? [], to: source.teachers ?? [], by: 'admin' })
        }
        if (lesson.lessonStart !== (source.lessonStart ?? '') || lesson.lessonEnd !== (source.lessonEnd ?? '')) {
            changes.push({
                date: now,
                type: 'times',
                from: `${lesson.lessonStart}-${lesson.lessonEnd}`,
                to: `${source.lessonStart ?? ''}-${source.lessonEnd ?? ''}`,
                by: 'admin'
            })
        }
        if (!!lesson.removed !== !!source.removed) {
            changes.push({ date: now, type: 'removed', from: !!lesson.removed, to: !!source.removed, by: 'admin' })
        }

        const update: any = {
            $set: {
                name: source.name ?? '',
                classroom: source.classroom ?? '',
                teachers: source.teachers ?? [],
                lessonStart: source.lessonStart ?? lesson.lessonStart,
                lessonEnd: source.lessonEnd ?? lesson.lessonEnd,
                removed: !!source.removed,
                'adminOverride.active': false
            },
            $unset: {
                'adminOverride.modifiedAt': 1,
                'adminOverride.modifiedBy': 1,
                'adminOverride.source': 1
            }
        }
        if (changes.length) update.$push = { changes: { $each: changes } }

        const updated = await Lesson.findByIdAndUpdate(id, update, { new: true })
        cache.invalidate()

        return res.json({ success: true, lesson: updated })
    } catch (err) {
        console.error(`Error clearing lesson override ${id}: ${err}`)
        return res.status(500).json({ success: false, error: 'Internal Server Error' })
    }
})

export default router
