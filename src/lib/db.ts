import { ISODate } from "@/lib/utils/type-utils"
import {
    DBSchema,
    IDBPDatabase,
    IDBPTransaction,
    openDB,
    StoreNames,
    StoreValue,
} from "idb"

export type Mdb = IDBPDatabase<MdbSchema>
export type MdId = string

export interface MdbSchema extends DBSchema {
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
    const db = await openDB<MdbSchema>("md_tracker", 3, {
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

    hookDbChanges(db)

    return db
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

export type DbChange = {
    [TStore in StoreNames<MdbSchema>]: { store: TStore } & {
        op:
            | {
                  type: "add"
                  value: StoreValue<MdbSchema, TStore>
                  key?: MdbSchema[TStore]["key"]
              }
            | {
                  type: "put"
                  value: StoreValue<MdbSchema, TStore>
                  key?: MdbSchema[TStore]["key"]
              }
            | {
                  type: "delete"
                  value?: undefined
                  key: MdbSchema[TStore]["key"]
              }
            | { type: "clear"; value?: undefined; key?: undefined }
    }
}[StoreNames<MdbSchema>]

export class DbChangeEvent extends Event {
    changes: Array<DbChange> = []

    constructor() {
        super("dbchange")
    }
}

// Emit a change event when a write transaction completes
function hookDbChanges(db: IDBPDatabase<any>) {
    const transaction = db.transaction.bind(db)
    db.transaction = (
        storeNames: string[] | string,
        mode?: "readwrite" | "readonly",
        options?: IDBTransactionOptions
    ) => {
        let txn = transaction(
            storeNames,
            mode,
            options
        ) as any as IDBPTransaction<any, [any], any>
        if (mode !== "readwrite") {
            return txn
        }

        const storeIds = (
            Array.isArray(storeNames) ? storeNames : [storeNames]
        ) as Array<StoreNames<MdbSchema>>

        const changeEvent = new DbChangeEvent()

        for (const storeId of storeIds) {
            const store = txn.objectStore(storeId)

            const add = store.add!.bind(store)
            store.add = (value, key) => {
                changeEvent.changes.push({
                    store: storeId,
                    op: { type: "add", value, key },
                })
                return add(value, key)
            }

            const put = store.put!.bind(store)
            store.put = (value, key) => {
                changeEvent.changes.push({
                    store: storeId,
                    op: { type: "put", value, key },
                })
                return put(value, key)
            }

            const delete_ = store.delete!.bind(store)
            store.delete = (key) => {
                changeEvent.changes.push({
                    store: storeId,
                    op: { type: "delete", key },
                })
                return delete_(key)
            }

            const clear = store.clear!.bind(store)
            store.clear = () => {
                changeEvent.changes.push({
                    store: storeId,
                    op: { type: "clear" },
                })
                return clear()
            }
        }

        txn.addEventListener("complete", () => {
            dispatchEvent(changeEvent)
        })

        return txn
    }
}
