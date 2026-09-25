
import mongoose, { Schema } from 'mongoose'

const SubjectRemapSchema = new Schema({
    enabled: { type: Boolean, default: true },

    match: {
        classes: [{ type: String }],
        groups: [{ type: String }],
        teachers: [{ type: String }],
        name: { type: String, required: true }
    },

    toName: { type: String, required: true },
    note: { type: String, default: '' },

    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
})

SubjectRemapSchema.index({ 'match.name': 1, enabled: 1 })

export default mongoose.model('SubjectRemap', SubjectRemapSchema)
