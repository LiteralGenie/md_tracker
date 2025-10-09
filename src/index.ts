import { initMdb, Mdb } from "@/lib/db"
import { registerMenuCommands } from "@/lib/register-menu-commands"
import { startDbReplication } from "@/lib/replicate-db"
import { handleLatest } from "@/lib/routes/latest/handleLatest"
import {
    exportLocalHistory,
    importRemoteHistory,
} from "@/lib/sync-md-history"

async function main() {
    const mdb = await initMdb()

    registerMenuCommands(mdb)

    await exportLocalHistory(mdb)
    await importRemoteHistory(mdb)

    await startDbReplication(mdb)

    await doRouting(mdb)
}

const ROUTES = [
    {
        patts: ["/titles/latest"],
        handler: handleLatest,
    },
]

async function doRouting(mdb: Mdb) {
    for (const route of ROUTES) {
        for (const patt of route.patts) {
            const exp = new RegExp(patt)

            const isMatch = exp.test(window.location.pathname)
            if (isMatch) {
                await route.handler(mdb)
            }
        }
    }
}

main()
