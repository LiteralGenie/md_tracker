import { KV_URL, META_KEY } from "@/lib/constants"
import { MdTrackerDb } from "@/lib/db"
import { postJson, uuidWithFallback } from "@/lib/utils/misc_utils"

export interface CreateKvTableOptions {
    name: string
    allow_guest_read: boolean
    allow_guest_write: boolean
}

export async function createKvTable(
    opts: CreateKvTableOptions,
    sid: string
) {
    return await postJson(KV_URL + "/create_kv", opts, {
        headers: { sid },
    })
}

export interface KvSession {
    sid: string
    username: string
    expires: string
}

export async function findKvSession(
    db: MdTrackerDb
): Promise<KvSession | null> {
    const sessionQuery = await db.rxdb.meta
        .findOne({
            selector: {
                key: META_KEY.KV_SESSION,
            },
        })
        .exec()

    if (!sessionQuery?.value) {
        return null
    }

    const session: KvSession = JSON.parse(sessionQuery.value)
    if (session.expires < new Date().toISOString()) {
        alert("[MdTracker] Sync session expired")

        await sessionQuery.remove()

        return null
    }

    return session
}

export async function findClientId(db: MdTrackerDb) {
    const idQuery = await db.rxdb.meta
        .findOne({
            selector: {
                key: META_KEY.CLIENT_ID,
            },
        })
        .exec()

    if (idQuery?.value) {
        const clientId = idQuery.value
        return clientId
    } else {
        const clientId = uuidWithFallback()

        await db.rxdb.meta.insert({
            key: META_KEY.CLIENT_ID,
            value: clientId,
        })

        return clientId
    }
}
