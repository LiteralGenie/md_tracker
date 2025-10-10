import { initMdb, Mdb } from "@/lib/db"
import { registerMenuCommands } from "@/lib/register-menu-commands"
import { startDbReplication } from "@/lib/replicate-db"
import { handleRecentlyAdded } from "@/lib/routes/recentlyAdded/handleRecentlyAdded"
import {
    exportLocalHistory,
    importRemoteHistory,
} from "@/lib/sync-md-history"

type AsyncCleanup = () => Promise<void>

import "@/app.css"

async function main() {
    const mdb = await initMdb()

    INIT_STYLES()

    hookNavigation()

    registerMenuCommands(mdb)

    async function onNavigation(): Promise<AsyncCleanup> {
        await exportLocalHistory(mdb)
        await importRemoteHistory(mdb)

        await startDbReplication(mdb)

        const routeCleanup = await doRouting(mdb)

        return async () => {
            await routeCleanup()
        }
    }

    // Don't need an initial onNavigation()
    // MD appears to trigger it via a replaceState event on page load
    let currHandler = Promise.resolve(async () => {})

    // Each soft navigation (pushState, replaceState, popState) triggers a call to onNavigation()
    // If a previous onNavigation() was scheduled, wait for that finish and cleanup before starting the new one
    window.addEventListener("fake_navigate", () => {
        currHandler = currHandler.then(async (cleanup) => {
            await cleanup()
            return await onNavigation()
        })
    })
}

const ROUTES = [
    {
        patts: ["/titles/latest"],
        handler: handleRecentlyAdded,
    },
]

async function doRouting(mdb: Mdb): Promise<AsyncCleanup> {
    for (const route of ROUTES) {
        for (const patt of route.patts) {
            const exp = new RegExp(patt)

            const isMatch = exp.test(window.location.pathname)
            if (isMatch) {
                return await route.handler(mdb)
            }
        }
    }

    return async () => {}
}

function hookNavigation() {
    // const pushState = history.pushState.bind(history)
    // history.pushState = (...args) => {
    //     pushState(...args)
    //     window.dispatchEvent(new Event("fake_navigate"))
    // }

    const replaceState = history.replaceState.bind(history)
    history.replaceState = (...args) => {
        replaceState(...args)
        window.dispatchEvent(new Event("fake_navigate"))
    }

    window.addEventListener("popstate", () => {
        window.dispatchEvent(new Event("fake_navigate"))
    })
}

main()
