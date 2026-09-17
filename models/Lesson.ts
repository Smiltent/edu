import mongoose, { Schema } from 'mongoose'

const LessonSourceSchema = new Schema({
    classroom: { type: String },
    name: { type: String },
    teachers: [{ type: String }],
    lessonStart: { type: String },
    lessonEnd: { type: String },
    removed: { type: Boolean }
}, { _id: false })

const LessonSchema = new Schema({
    week: { type: Schema.Types.ObjectId, ref: "Week", required: true },
    day: { type: String, required: true },

    lessonStart: { type: String, required: true },
    lessonEnd: { type: String, required: true },

    period: { type: Number, required: true },
    classroom: { type: String, required: true },
    name: { type: String, required: true },
    
    class: [{ type: String, required: true }],
    group: [{ type: String, required: true }],
    teachers: [{ type: String, required: true }],

    // soft-deleted when a period disappears from Edupage; keeps change history for the UI
    removed: { type: Boolean, default: false },

    // when set, live fields stay as the admin set them; scraper only updates source
    adminOverride: {
        active: { type: Boolean, default: false },
        modifiedAt: { type: Date },
        modifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
        source: { type: LessonSourceSchema }
    },

    changes: [{
        _id: false,
        date: { type: Date, required: true, default: Date.now },
        type: { type: String, required: true },
        from: { type: Schema.Types.Mixed },
        to: { type: Schema.Types.Mixed },
        by: { type: String } // "admin" when changed by a site admin
    }]
})

LessonSchema.index({ week: 1, period: 1, day: 1, class: 1, group: 1 })
LessonSchema.index({ week: 1, class: 1 })
LessonSchema.index({ week: 1, teachers: 1 })
LessonSchema.index({ week: 1, classroom: 1 })

export default mongoose.model('Lesson', LessonSchema)
