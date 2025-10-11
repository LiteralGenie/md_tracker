import { Mdb } from "@/lib/db"
import { findKvSession } from "@/lib/utils/kv-utils"

import { KvReplicator } from "@/lib/replication/replication-utils"
import { findClientId, KvSession } from "@/lib/utils/kv-utils"

export async function startDbReplication(db: Mdb) {
    const session = await findKvSession(db)
    if (!session) {
        console.warn(
            "Skipping replication, not logged in to sync server"
        )
        return
    }

    await replicateChapterHistory(db, session)
}

async function replicateChapterHistory(mdb: Mdb, session: KvSession) {
    const clientId = await findClientId(mdb)

    const replicator = new KvReplicator({
        clientId,
        replicationType: "chapter_history",
        kv: {
            session,
            table: "mdt_chapter_history",
        },
        idb: {
            mdb,
            replicationStore: "chapter_history",
            checkpointMetaKey:
                "chapter_history_replication_checkpoint",
            historyMetaKey: "chapter_history_replication_history",
        },
    })

    await replicator.createKvTable()
    await replicator.pushChanges()
    await replicator.pullChanges()
}
