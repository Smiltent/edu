
import mongoose, { Schema } from 'mongoose'
import Role from './Role.ts'

const UserSchema = new Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    favoriteNumber: { type: Number, required: true },
    roles: [{
        type: Schema.Types.ObjectId,
        ref: "Role",
        required: true,
    }],
    createdAt: { type: Date, required: true, default: Date.now }
})

UserSchema.pre('save', async function (next) {
    if (this.isNew && this.roles.length === 0) {
        const defaultRole = await Role.findOne({ name: 'user' })
        if (defaultRole) {
            this.roles.push(defaultRole._id)
        }
    }
    next()
})

export default mongoose.model('User', UserSchema)