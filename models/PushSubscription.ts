
import mongoose, { Schema } from 'mongoose'

const PushSubscriptionSchema = new Schema({
    endpoint: { type: String, required: true },
    keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
    },
    filterType: {
        type: String,
        required: true,
        enum: ["class", "teacher", "classroom"]
    },
    filterValue: { type: String, required: true },
    updatedAt: { type: Date, required: true, default: Date.now }
})

PushSubscriptionSchema.index({ endpoint: 1 }, { unique: true })
PushSubscriptionSchema.index({ filterType: 1, filterValue: 1 })

export default mongoose.model('PushSubscription', PushSubscriptionSchema)
