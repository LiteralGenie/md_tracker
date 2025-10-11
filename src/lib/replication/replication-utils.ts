import { KV_URL } from "@/lib/constants"
import {
    Mdb,
    MdTrackerSchema,
    ReplicationHistoryCheckpoint,
} from "@/lib/db"
import { createKvTable, KvSession } from "@/lib/utils/kv-utils"
import { nowIso, postJson } from "@/lib/utils/misc-utils"
import { last } from "radash"

type ReplicationStore = "chapter_history"
type HistoryMetaKey = "chapter_history_replication_history"
type CheckpointMetaKey = "chapter_history_replication_checkpoint"

export interface KvReplicatorOpts {
    clientId: string
    replicationType: string

    kv: {
        session: KvSession
        table: string
    }

    idb: {
        mdb: Mdb
        replicationStore: ReplicationStore
        historyMetaKey: HistoryMetaKey
        checkpointMetaKey: CheckpointMetaKey
    }
}

export class KvReplicator {
    constructor(public readonly opts: KvReplicatorOpts) {}

    async createKvTable() {
        const { session, table } = this.opts.kv

        await createKvTable(
            {
                name: table,
                allow_guest_read: false,
                allow_guest_write: false,
            },
            session.sid
        )

        await postJson(
            KV_URL + `/execute/${table}`,
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

    async pushChanges() {
        const {
            idb: { mdb },
        } = this.opts

        const needsReplication = await mdb.getAllFromIndex(
            this.opts.idb.historyMetaKey,
            "isReplicated",
            0
        )
        if (needsReplication.length === 0) {
            return
        }

        const changes = await Promise.all(
            needsReplication.map(
                async (r) =>
                    (await mdb.get(
                        this.opts.idb.replicationStore,
                        r.id
                    ))!
            )
        )

        console.log(
            `Pushing ${changes.length} ${this.opts.replicationType} rows`,
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
                '${this.opts.clientId}',
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
            KV_URL + `/execute/${this.opts.kv.table}`,
            {
                sql: script,
            },
            {
                headers: {
                    sid: this.opts.kv.session.sid,
                },
            }
        )

        const txn = mdb.transaction(
            this.opts.idb.historyMetaKey,
            "readwrite"
        )
        for (const r of needsReplication) {
            await txn.objectStore(this.opts.idb.historyMetaKey).put({
                ...r,
                isReplicated: 1,
                updatedAt: nowIso(),
            })
        }
        await txn.done
    }

    async pullChanges() {
        const mdb = this.opts.idb.mdb

        const checkpoint = (await mdb.get(
            "meta",
            this.opts.idb.checkpointMetaKey
        )) as ReplicationHistoryCheckpoint | undefined

        console.info(
            `Pulling ${this.opts.replicationType} updates with checkpoint`,
            checkpoint
        )

        const changes = await postJson<
            Array<{ id: number; rows: string }>
        >(
            KV_URL + `/select/${this.opts.kv.table}`,
            {
                sql: `--sql
                    SELECT id, rows
                    FROM changelog c
                    WHERE
                        id > ${checkpoint?.changelog_id || 0}
                        AND client_id != '${this.opts.clientId}'
                    ORDER BY id ASC
                    ;
                `,
            },
            {
                headers: {
                    sid: this.opts.kv.session.sid,
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
            KV_URL + `/select/${this.opts.kv.table}`,
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
                    sid: this.opts.kv.session.sid,
                },
            }
        )

        const documents = updates.map((r) =>
            JSON.parse(r.value)
        ) as Array<MdTrackerSchema[ReplicationStore]["value"]>

        console.info(
            `Pulled ${documents.length} ${this.opts.replicationType} rows from remote with checkpoint update`,
            checkpointUpdate,
            documents
        )

        const txn = mdb.transaction(
            [
                "meta",
                this.opts.idb.replicationStore,
                this.opts.idb.historyMetaKey,
            ] as const,
            "readwrite"
        )

        await txn
            .objectStore("meta")
            .put(checkpointUpdate, this.opts.idb.checkpointMetaKey)

        for (const r of documents) {
            await txn
                .objectStore(this.opts.idb.replicationStore)
                .put(r)
            await txn.objectStore(this.opts.idb.historyMetaKey).put({
                id: r.id,
                fromRemote: true,
                isReplicated: 1,
                updatedAt: nowIso(),
            })
        }

        await txn.done
    }
}
