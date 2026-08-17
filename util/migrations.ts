
import Role from "../models/Role.ts"

export default async function migrations() {
    const roles = [
        {
            name: "admin",
            permissions: [ 
                "basic",

                "group", 
                "group:manage",

                "admin",
                "admin:groups",
                "admin:users",
                "admin:roles",
                "admin:schedule"
            ]
        },
        {
            name: "teacher",
            permissions: [ 
                "basic", 
                "group",
                "group:manage"
            ]
        },
        {
            name: "user",
            permissions: [ 
                "basic"
            ]
        }
    ]

    for (const role of roles) {
        await Role.updateOne(
            { name: role.name },
            { $setOnInsert: role },
            { upsert: true }
        )
    }
}