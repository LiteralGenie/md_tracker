import { KV_URL } from "@/lib/constants"
import { MdTrackerDb } from "@/lib/db"
import {
    createKvTable,
    findClientId,
    findKvSession,
    KvSession,
} from "@/lib/utils/kv_utils"
import { postJson } from "@/lib/utils/misc_utils"
import { last } from "radash"
import { replicateRxCollection } from "rxdb/plugins/replication"

export async function replicateDb(db: MdTrackerDb) {
    const session = await findKvSession(db)
    if (!session) {
        console.warn(
            "Skipping replication, not logged in to sync server"
        )
        return
    }

    await replicateChapterHistory(db, session)
}

async function replicateChapterHistory(
    db: MdTrackerDb,
    session: KvSession
) {
    const clientId = await findClientId(db)
    const now = new Date().toISOString()

    await createKvTable(
        {
            name: "mdt_chapter_history",
            allow_guest_read: false,
            allow_guest_write: false,
        },
        session.sid
    )

    await createKvTable(
        {
            name: "mdt_checkpoints",
            allow_guest_read: false,
            allow_guest_write: false,
        },
        session.sid
    )

    // @todo: ditch rxdb, the only thing we're getting is schema to type hints
    //        docs (eg for replication) are hard to read and
    //        we're implementing almost everything (conflict resolution, insertions, etc) ourselves
    //        plus there's upsell ads everywhere
    const replicationState = await replicateRxCollection({
        collection: db.rxdb.collections.chapter_history,
        replicationIdentifier: "???",
        push: {
            async handler(rows) {
                console.info(`Pushing ${rows.length} rows to remote`)

                await postJson(
                    KV_URL + "/kv/mdt_chapter_history",
                    {
                        items: rows.map((r) => [
                            r.newDocumentState.id,
                            JSON.stringify({
                                ...r.newDocumentState,
                                _clientId: clientId,
                                _updatedAt: now,
                            }),
                        ]),
                    },
                    {
                        headers: {
                            sid: session.sid,
                        },
                    }
                )
                return []
            },
        },
        pull: {
            // @todo: there's technically a race condition if ...
            //          client A starts   push
            //          client B starts   push
            //          client B finishes push
            //          client C starts   pull
            //          client C finishes pull
            //          client A finishes push
            //
            //        which causes C to only receive B's and never A's
            //        because C's checkpoint will update to the date from B
            //        which is later than A
            //
            //        maybe have an append-only table as a changelog
            //        each push generates an entry
            //        pulls check the changelog with rowid as checkpoint instead of timestamp

            async handler(checkpoint?: { updatedAt: string }) {
                console.info(
                    "Pulling updates with checkpoint",
                    checkpoint
                )

                const data = await postJson<{ value: string }[]>(
                    KV_URL + `/execute/mdt_chapter_history`,
                    {
                        sql: `--sql
                            SELECT value
                            FROM kv
                            WHERE
                                JSON_EXTRACT(value, '$._clientId') != '${clientId}'
                                AND JSON_EXTRACT(value, '$._updatedAt') > '${
                                    checkpoint?.updatedAt ?? 0
                                }'
                            ORDER BY JSON_EXTRACT(value, '$._updatedAt') ASC
                            ;
                        `,
                    },
                    {
                        headers: {
                            sid: session.sid,
                        },
                    }
                )

                const rows = data.map((raw) => JSON.parse(raw.value))
                const checkpointUpdate = {
                    updatedAt:
                        last(rows)?._updatedAt ||
                        checkpoint?.updatedAt,
                }

                console.info(
                    `Pulling ${data.length} rows from remote with checkpoint update`,
                    checkpointUpdate
                )

                for (const r of rows) {
                    delete r["_clientId"]
                    delete r["_updatedAt"]
                }

                return {
                    documents: rows,
                    checkpoint: checkpointUpdate,
                }
            },
        },
    })
}
