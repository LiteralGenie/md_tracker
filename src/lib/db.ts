import { ISODate } from "@/lib/utils/type_utils"
import { DBSchema, IDBPDatabase, openDB } from "idb"

export type Mdb = IDBPDatabase<MdTrackerSchema>

export async function initMdb(): Promise<Mdb> {
    return await openDB<MdTrackerSchema>("md_tracker", 1, {
        upgrade(db) {
            const meta = db.createObjectStore("meta", {
                keyPath: null,
                autoIncrement: false,
            })

            const chapter_history = db.createObjectStore(
                "chapter_history",
                {
                    keyPath: "id",
                }
            )

            const chapter_history_replication_history =
                db.createObjectStore(
                    "chapter_history_replication_history",
                    {
                        keyPath: "id",
                    }
                )
            chapter_history_replication_history.createIndex(
                "isReplicated",
                "isReplicated"
            )
        },
    })
}

export interface MdTrackerSchema extends DBSchema {
    meta: {
        key: string
        value: any
    }
    chapter_history: {
        key: string
        value: {
            id: string
            cid: string
            timestamp: ISODate
        }
    }
    chapter_history_replication_history: {
        key: string
        value: ReplicationHistoryItem
        indexes: {
            isReplicated: ReplicationHistoryItem["isReplicated"]
        }
    }
}

export type ReplicationHistoryItem = {
    id: any
    isReplicated: 0 | 1
    fromRemote: boolean
    updatedAt: ISODate
}

export interface ReplicationHistoryCheckpoint {
    changelog_id: number
}
