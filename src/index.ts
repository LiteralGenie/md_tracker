import { MdTrackerDb } from "@/lib/db"
import { handleLatest } from "@/lib/routes/latest/handleLatest"
import { syncMdHistory } from "@/lib/sync-md-history"
import { addRxPlugin } from "rxdb"
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode"

async function main() {
    addRxPlugin(RxDBDevModePlugin)

    const db = await MdTrackerDb.ainit()
    await syncMdHistory(db)

    await doRouting()
}

const ROUTES = [
    {
        patts: ["/titles/latest"],
        handler: handleLatest,
    },
]

async function doRouting() {
    for (const route of ROUTES) {
        for (const patt of route.patts) {
            const exp = new RegExp(patt)

            const isMatch = exp.test(window.location.pathname)
            if (isMatch) {
                await route.handler()
            }
        }
    }
}

main()
