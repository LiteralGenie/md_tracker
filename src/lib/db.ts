import {
    createRxDatabase,
    ExtractDocumentTypeFromTypedRxJsonSchema,
    RxCollection,
    RxDatabase,
    toTypedRxJsonSchema,
} from "rxdb"
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie"
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv"

export class MdTrackerDb {
    constructor(public rxdb: RxDatabase<SchemaType>) {}

    static async ainit() {
        const db = await MdTrackerDb.initDb()

        return new MdTrackerDb(db)
    }

    private static async initDb() {
        const db = await createRxDatabase<any>({
            name: "md_tracker",
            storage: wrappedValidateAjvStorage({
                storage: getRxStorageDexie(),
            }),
        })

        await db.addCollections(DB_SCHEMA)

        return db
    }
}

const DB_SCHEMA = {
    meta: {
        schema: {
            version: 0,
            primaryKey: "key",
            type: "object",
            properties: {
                key: {
                    type: "string",
                    maxLength: 100,
                },
                value: {
                    type: "string",
                },
            },
        },
    },
    chapter_history: {
        schema: {
            version: 0,
            primaryKey: "id",
            type: "object",
            properties: {
                id: {
                    type: "string",
                    maxLength: 100,
                },
                cid: {
                    type: "string",
                },
                timestamp: {
                    type: "string",
                    format: "date-time",
                },
            },
            required: ["id", "cid", "timestamp"],
        },
    },
} as const

type TOS = typeof DB_SCHEMA
type SchemaType = {
    [K in keyof TOS]: RxCollection<
        ExtractDocumentTypeFromTypedRxJsonSchema<
            ReturnType<typeof toTypedRxJsonSchema<TOS[K]["schema"]>>
        >,
        {},
        {}
    >
}
