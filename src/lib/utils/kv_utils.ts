import { KV_URL, META_KEY } from "@/lib/constants"
import { Mdb } from "@/lib/db"
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
    db: Mdb
): Promise<KvSession | null> {
    const session: KvSession | undefined = await db.get(
        "meta",
        META_KEY.KV_SESSION
    )

    if (!session) {
        return null
    } else if (session.expires < new Date().toISOString()) {
        alert("[MdTracker] Sync session expired")
        await db.delete("meta", META_KEY.KV_SESSION)
        return null
    }

    return session
}

export async function findClientId(db: Mdb) {
    let clientId = await db.get("meta", META_KEY.CLIENT_ID)

    if (!clientId) {
        clientId = uuidWithFallback()
        await db.put("meta", clientId, META_KEY.CLIENT_ID)
    }

    return clientId
}
