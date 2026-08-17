
import bcrypt from "bcryptjs"

import { createSession, destroyUserSessions } from "./session.service.ts"
import Role from "../models/Role.ts"
import User from "../models/User.ts"

interface UserData {
    username?: string,
    password?: string,
    favoriteNumber?: number,
    roles?: string[]
}

interface LoginMeta {
    userAgent?: string,
    ip?: string
}

async function register(username: string, password: string, favoriteNumber: number, role: string = 'user') {
    const checkExisting = await User.findOne({ username })
    if (checkExisting) throw new Error("username already taken")

    const roleDoc = await Role.findOne({ name: role })

    const hash = await bcrypt.hash(password, 10)
    const user = await User.create({
        username,
        password: hash,
        favoriteNumber,
        roles: roleDoc ? [roleDoc._id] : []
    })

    console.debug("a user has registered")

    return user
}

async function login(username: string, password: string, meta: LoginMeta = {}) {
    const user = await User.findOne({ username })
    if (!user) throw new Error("user with that password not found")

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) throw new Error("user with that password not found")

    console.debug('a user has logged in')

    return await createSession(user._id, meta)
}

async function del(username: string) {
    const user = await User.findOne({ username })
    if (!user) throw new Error("user not found")

    // delete from db
    await User.deleteOne({ _id: user._id })
    await destroyUserSessions(user._id)

    console.debug(`user ${username} deleted`)

    return true
}

const allowedFields = ['username', 'password', 'roles', 'favoriteNumber']
async function modify(ogUsername: string, newData: UserData) {
    const user = await User.findOne({ username: ogUsername })
    if (!user) throw new Error("user not found")

    // security check / only keep what may be written to
    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
        const value = newData[field as keyof UserData]
        if (value !== undefined && value !== "") data[field] = value
    }

    // hash the password, if changed
    if (typeof data.password === "string") {
        data.password = await bcrypt.hash(data.password, 10)
    }

    Object.assign(user, data)
    await user.save()

    // a changed password or username shouldn't keep the old logins alive
    if (data.password || data.username) await destroyUserSessions(user._id)

    console.debug(`user ${ogUsername} modified`)

    return user
}

async function list() {
    return await User.find().select("-password -__v")
}

export { register, login, del, modify, list }
