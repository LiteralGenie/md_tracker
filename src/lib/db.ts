import { ISODate } from "@/lib/utils/type-utils"
import { DBSchema, IDBPDatabase, openDB } from "idb"

export type Mdb = IDBPDatabase<MdTrackerSchema>
export type MdId = string

export interface MdTrackerSchema extends DBSchema {
    meta: {
        key: string
        value: any
    }
    chapter_history: {
        key: MdId
        value: {
            id: MdId
            cid: MdId
            timestamp: ISODate
        }
    }
    chapter_history_replication_history: ReplicationHistory
    md_api: {
        key: MdId
        value: {
            id: MdId
            data: any
            updatedAt: ISODate
        }
    }
    md_api_replication_history: ReplicationHistory
    md_chapter_to_title: {
        key: MdId
        value: {
            chapter: MdId
            title: MdId
        }
    }
}

export async function initMdb(): Promise<Mdb> {
    return await openDB<MdTrackerSchema>("md_tracker", 3, {
        upgrade(db, oldVersion, newVersion, txn) {
            oldVersion = oldVersion ?? 0
            const oldOldVersion = oldVersion

            while (true) {
                if (oldVersion === 0) {
                    db.createObjectStore("meta", {
                        keyPath: null,
                        autoIncrement: false,
                    })

                    db.createObjectStore("chapter_history", {
                        keyPath: "id",
                    })

                    db.createObjectStore(
                        "chapter_history_replication_history",
                        {
                            keyPath: "id",
                        }
                    )
                    txn.objectStore(
                        "chapter_history_replication_history"
                    ).createIndex("isReplicated", "isReplicated")

                    db.createObjectStore("md_api", {
                        keyPath: "id",
                    })
                } else if (oldVersion === 1) {
                    db.createObjectStore("md_chapter_to_title", {
                        keyPath: "chapter",
                    })
                } else if (oldVersion === 2) {
                    db.createObjectStore(
                        "md_api_replication_history",
                        {
                            keyPath: "id",
                        }
                    )
                    txn.objectStore(
                        "md_api_replication_history"
                    ).createIndex("isReplicated", "isReplicated")
                } else {
                    break
                }

                newVersion = (oldVersion ?? 0) + 1
                oldVersion = newVersion
            }

            console.log(
                `Migrated from ${oldOldVersion} to ${newVersion}`
            )
        },
    })
}

export interface ReplicationHistoryCheckpoint {
    changelog_id: number
}

type ReplicationHistory = {
    key: string
    value: {
        id: any
        isReplicated: 0 | 1
        fromRemote: boolean
        updatedAt: ISODate
    }
    indexes: {
        isReplicated: 0 | 1
    }
}
