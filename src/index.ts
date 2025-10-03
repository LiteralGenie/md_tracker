import { MdTrackerDb } from "@/lib/db"
import { handleLatest } from "@/lib/routes/latest/handleLatest"
import {
    exportLocalHistory,
    importRemoteHistory,
} from "@/lib/sync-md-history"
import { addRxPlugin } from "rxdb"
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode"

async function main() {
    addRxPlugin(RxDBDevModePlugin)

    const db = await MdTrackerDb.ainit()
    await exportLocalHistory(db)
    await importRemoteHistory(db)

    await doRouting(db)
}

const ROUTES = [
    {
        patts: ["/titles/latest"],
        handler: handleLatest,
    },
]

async function doRouting(db: MdTrackerDb) {
    for (const route of ROUTES) {
        for (const patt of route.patts) {
            const exp = new RegExp(patt)

            const isMatch = exp.test(window.location.pathname)
            if (isMatch) {
                await route.handler(db)
            }
        }
    }
}

main()
