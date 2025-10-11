import {
    Mdb,
    MdTrackerSchema,
    ReplicationHistoryCheckpoint,
} from "@/lib/db"
import { createKvTable, KvSession } from "@/lib/utils/kv-utils"
import { nowIso, postJson } from "@/lib/utils/misc-utils"
import { last } from "radash"

export const REPLICATION_CONFIGS = {
    chapter_history: {
        type: "chapter_history",
        kvTable: "mdt_chapter_history",
        store: "chapter_history",
        historyStore: "chapter_history_replication_history",
        checkpointMetaKey: "chapter_history_replication_checkpoint",
    },
    md_api: {
        type: "md_api",
        kvTable: "mdt_md_api",
        store: "md_api",
        historyStore: "md_api_replication_history",
        checkpointMetaKey: "md_api_replication_checkpoint",
    },
} as const
export type ReplicationConfig =
    (typeof REPLICATION_CONFIGS)[keyof typeof REPLICATION_CONFIGS]

export interface KvReplicatorOpts {
    clientId: string
    session: KvSession
    mdb: Mdb
    syncServerUrl: string
    config: ReplicationConfig
}

export class KvReplicator {
    constructor(public readonly opts: KvReplicatorOpts) {}

    async createKvTable() {
        await createKvTable(
            this.opts.syncServerUrl,
            {
                name: this.opts.config.kvTable,
                allow_guest_read: false,
                allow_guest_write: false,
            },
            this.opts.session.sid
        )

        await postJson(
            this.opts.syncServerUrl +
                `/execute/${this.opts.config.kvTable}`,
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
                    sid: this.opts.session.sid,
                },
            }
        )
    }

    async insertMissingHistory() {
        const rs = await this.opts.mdb.getAll(this.opts.config.store)

        for (const r of rs) {
            const historyItem = await this.opts.mdb.get(
                this.opts.config.historyStore,
                r.id
            )
            if (!!historyItem) {
                continue
            }

            await this.opts.mdb.add(this.opts.config.historyStore, {
                id: r.id,
                isReplicated: 0,
                fromRemote: false,
                updatedAt: new Date().toISOString(),
            })
        }
    }

    async pushChanges() {
        const needsReplication = await this.opts.mdb.getAllFromIndex(
            this.opts.config.historyStore,
            "isReplicated",
            0
        )
        if (needsReplication.length === 0) {
            return
        }

        const changes = await Promise.all(
            needsReplication.map(
                async (r) =>
                    (await this.opts.mdb.get(
                        this.opts.config.store,
                        r.id
                    ))!
            )
        )

        console.log(
            `Pushing ${changes.length} ${this.opts.config.type} rows`,
            changes
        )

        const kvInserts = changes.map(
            // Replacements don't happen normally, only when client / server db is manually edited
            (r) => `--sql
                INSERT OR REPLACE INTO kv (
                    key, value
                ) VALUES (
                    '${r.id}',
                    '${JSON.stringify(r).replaceAll("'", "''")}'
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
            this.opts.syncServerUrl +
                `/execute/${this.opts.config.kvTable}`,
            {
                sql: script,
            },
            {
                headers: {
                    sid: this.opts.session.sid,
                },
            }
        )

        const txn = this.opts.mdb.transaction(
            this.opts.config.historyStore,
            "readwrite"
        )
        for (const r of needsReplication) {
            await txn.objectStore(this.opts.config.historyStore).put({
                ...r,
                isReplicated: 1,
                updatedAt: nowIso(),
            })
        }
        await txn.done
    }

    async pullChanges() {
        const checkpoint = (await this.opts.mdb.get(
            "meta",
            this.opts.config.checkpointMetaKey
        )) as ReplicationHistoryCheckpoint | undefined

        console.info(
            `Pulling ${this.opts.config.type} updates with checkpoint`,
            checkpoint
        )

        const changes = await postJson<
            Array<{ id: number; rows: string }>
        >(
            this.opts.syncServerUrl +
                `/select/${this.opts.config.kvTable}`,
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
                    sid: this.opts.session.sid,
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
            this.opts.syncServerUrl +
                `/select/${this.opts.config.kvTable}`,
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
                    sid: this.opts.session.sid,
                },
            }
        )

        const documents = updates.map((r) =>
            JSON.parse(r.value)
        ) as Array<
            MdTrackerSchema[ReplicationConfig["store"]]["value"]
        >

        console.info(
            `Pulled ${documents.length} ${this.opts.config.type} rows from remote with checkpoint update`,
            checkpointUpdate,
            documents
        )

        const txn = this.opts.mdb.transaction(
            [
                "meta",
                this.opts.config.store,
                this.opts.config.historyStore,
            ] as const,
            "readwrite"
        )

        await txn
            .objectStore("meta")
            .put(checkpointUpdate, this.opts.config.checkpointMetaKey)

        for (const r of documents) {
            await txn.objectStore(this.opts.config.store).put(r)
            await txn.objectStore(this.opts.config.historyStore).put({
                id: r.id,
                fromRemote: true,
                isReplicated: 1,
                updatedAt: nowIso(),
            })
        }

        await txn.done
    }
}
