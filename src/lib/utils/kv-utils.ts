import { KV_URL, META_KEY } from "@/lib/constants"
import { Mdb } from "@/lib/db"
import { postJson, uuidWithFallback } from "@/lib/utils/misc-utils"

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
    mdb: Mdb
): Promise<KvSession | null> {
    const session: KvSession | undefined = await mdb.get(
        "meta",
        META_KEY.KV_SESSION
    )

    if (!session) {
        return null
    } else if (session.expires < new Date().toISOString()) {
        alert("[MdTracker] Sync session expired")
        await mdb.delete("meta", META_KEY.KV_SESSION)
        return null
    }

    return session
}

export async function findClientId(mdb: Mdb) {
    let clientId = await mdb.get("meta", META_KEY.CLIENT_ID)

    if (!clientId) {
        clientId = uuidWithFallback()
        await mdb.put("meta", clientId, META_KEY.CLIENT_ID)
    }

    return clientId
}
