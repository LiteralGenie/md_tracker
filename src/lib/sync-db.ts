import { KV_URL } from "@/lib/constants"
import { MdTrackerDb } from "@/lib/db"
import { replicateRxCollection } from "rxdb/plugins/replication"

export async function syncDb(db: MdTrackerDb) {}

async function createSession(db: MdTrackerDb) {}

async function replicateChapterHistory(db: MdTrackerDb) {
    await fetch(KV_URL + "/create_kv/", {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    })

    const replicationState = await replicateRxCollection({
        collection: db.rxdb.collections.chapter_history,
        replicationIdentifier: "???",
        push: {
            async handler(rows) {
                const rawResponse = await fetch(KV_URL + "/kv/", {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(rows),
                })
                const conflictsArray = await rawResponse.json()
                return conflictsArray
            },
        },
        pull: {},
    })
}

for (const x of Object.entries(db.rxdb.collections)) {
}
