
import mongoose, { Schema } from 'mongoose'

const SessionSchema = new Schema({
    token: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },

    userAgent: { type: String, default: "unknown" },
    ip: { type: String, default: "unknown" },

    createdAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true }
})

SessionSchema.index({ user: 1 })
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model('Session', SessionSchema)
