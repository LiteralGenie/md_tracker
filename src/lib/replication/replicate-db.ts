import { Mdb } from "@/lib/db"
import { findKvSession } from "@/lib/utils/kv-utils"

import {
    KvReplicator,
    REPLICATION_CONFIGS,
} from "@/lib/replication/replication-utils"
import { findClientId } from "@/lib/utils/kv-utils"

export async function startDbReplication(mdb: Mdb) {
    const session = await findKvSession(mdb)
    if (!session) {
        console.warn(
            "Skipping replication, not logged in to sync server"
        )
        return
    }

    const clientId = await findClientId(mdb)

    const todo = [
        REPLICATION_CONFIGS.chapter_history,
        REPLICATION_CONFIGS.md_api,
    ].map(async (config) => {
        const replicator = new KvReplicator({
            clientId,
            session,
            mdb,
            config,
        })

        await replicator.insertMissingHistory()
        await replicator.createKvTable()
        await replicator.pushChanges()
        await replicator.pullChanges()
    })

    await Promise.all(todo)
}
