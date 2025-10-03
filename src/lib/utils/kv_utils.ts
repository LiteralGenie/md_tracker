import { KV_URL, META_KEY_KV_SESSION } from "@/lib/constants"
import { MdTrackerDb } from "@/lib/db"

export async function loginKv(
    username: string,
    password: string
): string {
    await fetch(KV_URL + "/create_kv/", {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    })
}

export function createKvTable() {}

interface KvSession {
    sid: string
    username: string
}

export async function findKvSession(
    db: MdTrackerDb
): Promise<KvSession | null> {
    const session_query = await db.rxdb.meta
        .findOne({
            selector: {
                key: META_KEY_KV_SESSION,
            },
        })
        .exec()

    return session_query?.value
        ? JSON.parse(session_query.value)
        : null
}
