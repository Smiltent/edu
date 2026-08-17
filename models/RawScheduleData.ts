
import mongoose, { Schema } from 'mongoose'

const RawScheduleDataSchema = new Schema({
    week: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true }
})

RawScheduleDataSchema.index({ week: 1 }, { unique: true })

export default mongoose.model('RawScheduleData', RawScheduleDataSchema)
