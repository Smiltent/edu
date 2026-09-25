
import { applyRemapToExistingLessons, invalidateSubjectRemapCache, normalizeRule } from '@/services/subjectRemap.service.ts'
import { userAuth, requirePermission } from '@/middlewares/auth.middleware.ts'
import SubjectRemap from '@/models/SubjectRemap.ts'
import cache from '@/util/cache.ts'

import { Router } from 'express'
const router = Router()

function parseList(value: any): string[] {
    if (Array.isArray(value)) {
        return value.map((v) => String(v).trim()).filter(Boolean)
    }
    return String(value ?? '')
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
}

function bodyToRule(body: any) {
    const matchName = String(body.matchName ?? body.match?.name ?? '').trim()
    const toName = String(body.toName ?? '').trim()

    return {
        enabled: body.enabled === undefined ? true : !!body.enabled && body.enabled !== 'false',
        match: {
            classes: parseList(body.classes ?? body.match?.classes),
            groups: parseList(body.groups ?? body.match?.groups),
            teachers: parseList(body.teachers ?? body.match?.teachers),
            name: matchName
        },
        toName,
        note: String(body.note ?? '').trim()
    }
}

router.get('/', userAuth, requirePermission('admin'), async (_req, res) => {
    try {
        const rules = await SubjectRemap.find().sort({ updatedAt: -1 }).lean()
        return res.json({ success: true, rules })
    } catch (err) {
        console.error(`Error listing subject remaps: ${err}`)
        return res.status(500).json({ success: false, error: 'Internal Server Error' })
    }
})

router.post('/', userAuth, requirePermission('admin'), async (req, res) => {
    try {
        const data = bodyToRule(req.body ?? {})
        if (!data.match.name || !data.toName) {
            return res.status(400).json({ success: false, error: 'matchName and toName are required' })
        }

        const rule = await SubjectRemap.create({
            ...data,
            updatedAt: new Date(),
            updatedBy: req.user._id
        })

        const applied = await applyRemapToExistingLessons(normalizeRule(rule.toObject()))
        invalidateSubjectRemapCache()
        cache.invalidate()

        return res.json({ success: true, rule, applied })
    } catch (err) {
        console.error(`Error creating subject remap: ${err}`)
        return res.status(500).json({ success: false, error: 'Internal Server Error' })
    }
})

router.patch('/:id', userAuth, requirePermission('admin'), async (req, res) => {
    const { id } = req.params
    if (!id) return res.status(400).json({ success: false, error: 'Missing id' })

    try {
        const existing = await SubjectRemap.findById(id)
        if (!existing) return res.status(404).json({ success: false, error: 'Not found' })

        const data = bodyToRule({
            enabled: req.body?.enabled ?? existing.enabled,
            matchName: req.body?.matchName ?? req.body?.match?.name ?? existing.match?.name,
            toName: req.body?.toName ?? existing.toName,
            classes: req.body?.classes ?? req.body?.match?.classes ?? existing.match?.classes,
            groups: req.body?.groups ?? req.body?.match?.groups ?? existing.match?.groups,
            teachers: req.body?.teachers ?? req.body?.match?.teachers ?? existing.match?.teachers,
            note: req.body?.note ?? existing.note
        })

        if (!data.match.name || !data.toName) {
            return res.status(400).json({ success: false, error: 'matchName and toName are required' })
        }

        existing.enabled = data.enabled
        existing.match = data.match as any
        existing.toName = data.toName
        existing.note = data.note
        existing.updatedAt = new Date()
        existing.updatedBy = req.user._id
        await existing.save()

        const applied = data.enabled
            ? await applyRemapToExistingLessons(normalizeRule(existing.toObject()))
            : 0

        invalidateSubjectRemapCache()
        cache.invalidate()

        return res.json({ success: true, rule: existing, applied })
    } catch (err) {
        console.error(`Error updating subject remap ${id}: ${err}`)
        return res.status(500).json({ success: false, error: 'Internal Server Error' })
    }
})

/**
 * DELETE /v2/admin/subjectRemaps/:id
 */
router.delete('/:id', userAuth, requirePermission('admin'), async (req, res) => {
    const { id } = req.params
    if (!id) return res.status(400).json({ success: false, error: 'Missing id' })

    try {
        const deleted = await SubjectRemap.findByIdAndDelete(id)
        if (!deleted) return res.status(404).json({ success: false, error: 'Not found' })

        invalidateSubjectRemapCache()
        cache.invalidate()

        return res.json({ success: true })
    } catch (err) {
        console.error(`Error deleting subject remap ${id}: ${err}`)
        return res.status(500).json({ success: false, error: 'Internal Server Error' })
    }
})

export default router
