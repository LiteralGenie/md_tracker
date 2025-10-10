import { KV_URL } from "@/lib/constants"
import {
    Mdb,
    MdTrackerSchema,
    ReplicationHistoryCheckpoint,
} from "@/lib/db"
import {
    createKvTable,
    findClientId,
    findKvSession,
    KvSession,
} from "@/lib/utils/kv_utils"
import { nowIso, postJson } from "@/lib/utils/misc_utils"
import { last } from "radash"

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

    await createChapterHistoryTable()

    await pushChanges()
    await pullChanges()

    async function createChapterHistoryTable() {
        await createKvTable(
            {
                name: "mdt_chapter_history",
                allow_guest_read: false,
                allow_guest_write: false,
            },
            session.sid
        )

        await postJson(
            KV_URL + `/execute/mdt_chapter_history`,
            {
                sql: `--sql
                CREATE TABLE IF NOT EXISTS meta (
                    key         TEXT        PRIMARY KEY,
                    value       BLOB        NOT NULL
                );

                CREATE TABLE IF NOT EXISTS changelog (
                    id          INTEGER     PRIMARY KEY,
                    client_id   TEXT        NOT NULL,
                    rows        JSON        NOT NULL
                );

                INSERT OR IGNORE INTO meta (
                    key, value
                ) VALUES (
                    'changelog_id', 0
                )
            `,
            },
            {
                headers: {
                    sid: session.sid,
                },
            }
        )
    }

    async function pushChanges() {
        const needsReplication = await mdb.getAllFromIndex(
            "chapter_history_replication_history",
            "isReplicated",
            0
        )
        if (needsReplication.length === 0) {
            return
        }

        const changes = await Promise.all(
            needsReplication.map(
                async (r) => (await mdb.get("chapter_history", r.id))!
            )
        )

        console.log(
            `Pushing ${changes.length} chapter_history rows`,
            changes
        )

        const kvInserts = changes.map(
            // Replacements don't happen normally, only when client / server db is manually edited
            (r) => `--sql
                INSERT OR REPLACE INTO kv (
                    key, value
                ) VALUES (
                    '${r.id}',
                    '${JSON.stringify(r)}'
                );
            `
        )

        const changelogInsert = `--sql
            INSERT INTO changelog (
                id, client_id, rows
            ) VALUES (
                (SELECT value + 1 FROM meta WHERE key = 'changelog_id'),
                '${clientId}',
                '${JSON.stringify(changes.map((r) => r.id))}'
            );
        `

        const metaUpdate = `--sql
            UPDATE meta
            SET value = (
                SELECT value + 1 from meta WHERE key = 'changelog_id'
            )
            WHERE key = 'changelog_id';
        `

        const script = `--sql
            BEGIN;

            ${kvInserts.join("\n")}

            ${changelogInsert}

            ${metaUpdate}

            COMMIT;
        `

        await postJson(
            KV_URL + "/execute/mdt_chapter_history",
            {
                sql: script,
            },
            {
                headers: {
                    sid: session.sid,
                },
            }
        )

        const txn = mdb.transaction(
            "chapter_history_replication_history",
            "readwrite"
        )
        for (const r of needsReplication) {
            await txn
                .objectStore("chapter_history_replication_history")
                .put({
                    ...r,
                    isReplicated: 1,
                    updatedAt: nowIso(),
                })
        }
        await txn.done
    }

    async function pullChanges() {
        const checkpoint = (await mdb.get(
            "meta",
            "chapter_history_replication_checkpoint"
        )) as ReplicationHistoryCheckpoint | undefined

        console.info("Pulling updates with checkpoint", checkpoint)

        const changes = await postJson<
            Array<{ id: number; rows: string }>
        >(
            KV_URL + `/select/mdt_chapter_history`,
            {
                sql: `--sql
                    SELECT id, rows
                    FROM changelog c
                    WHERE
                        id > ${checkpoint?.changelog_id || 0}
                        AND client_id != '${clientId}'
                    ORDER BY id ASC
                    ;
                `,
            },
            {
                headers: {
                    sid: session.sid,
                },
            }
        )
        if (!changes.length) {
            return
        }

        const checkpointUpdate: ReplicationHistoryCheckpoint = {
            changelog_id: last(changes)!.id,
        }

        const ids: string[] = changes.flatMap(({ rows }) =>
            JSON.parse(rows)
        )

        const updates: Array<{ value: string }> = await postJson(
            KV_URL + "/select/mdt_chapter_history",
            {
                sql: `--sql
                    SELECT value
                    FROM kv
                    WHERE key IN (
                        ${ids.map((id) => `'${id}'`).join(", ")}
                    )
                `,
            },
            {
                headers: {
                    sid: session.sid,
                },
            }
        )

        const documents = updates.map((r) =>
            JSON.parse(r.value)
        ) as Array<MdTrackerSchema["chapter_history"]["value"]>

        console.info(
            `Pulled ${documents.length} rows from remote with checkpoint update`,
            checkpointUpdate,
            documents
        )

        const txn = mdb.transaction(
            [
                "meta",
                "chapter_history",
                "chapter_history_replication_history",
            ] as const,
            "readwrite"
        )

        await txn
            .objectStore("meta")
            .put(
                checkpointUpdate,
                "chapter_history_replication_checkpoint"
            )

        for (const r of documents) {
            await txn.objectStore("chapter_history").put(r)
            await txn
                .objectStore("chapter_history_replication_history")
                .put({
                    id: r.id,
                    fromRemote: true,
                    isReplicated: 1,
                    updatedAt: nowIso(),
                })
        }

        await txn.done
    }
}
