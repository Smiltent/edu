
import mongoose, { Schema } from 'mongoose'

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
    teachers: [{ type: String, required: true }]
})

LessonSchema.index({ week: 1, period: 1, day: 1, class: 1, group: 1 })
LessonSchema.index({ week: 1, class: 1 })
LessonSchema.index({ week: 1, teachers: 1 })
LessonSchema.index({ week: 1, classroom: 1 })

export default mongoose.model('Lesson', LessonSchema)