import { initMdb, Mdb } from "@/lib/db"
import { registerMenuCommands } from "@/lib/register-menu-commands"
import { startDbReplication } from "@/lib/replication/replicate-db"
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

    async function onNavigation(
        abortSignal: AbortSignal
    ): Promise<AsyncCleanup> {
        await exportLocalHistory(mdb)
        await importRemoteHistory(mdb)

        await startDbReplication(mdb)

        const routeCleanup = await doRouting(mdb, abortSignal)

        return async () => {
            await routeCleanup()
        }
    }

    // Don't need an initial onNavigation()
    // MD appears to trigger it via a replaceState event on page load
    let currHandler = Promise.resolve(async () => {})
    let currAborter = new AbortController()

    // Each soft navigation (pushState, replaceState, popState) triggers a call to onNavigation()
    // If a previous onNavigation() was scheduled, wait for that finish and cleanup before starting the new one
    window.addEventListener("fake_navigate", () => {
        currAborter.abort("abort")
        currAborter = new AbortController()

        currHandler = currHandler.then(async (cleanup) => {
            await cleanup()
            return await onNavigation(currAborter.signal)
        })
    })
}

const ROUTES = [
    {
        patts: ["/titles/recent"],
        handler: handleRecentlyAdded,
    },
]

async function doRouting(
    mdb: Mdb,
    abortSignal: AbortSignal
): Promise<AsyncCleanup> {
    for (const route of ROUTES) {
        for (const patt of route.patts) {
            const exp = new RegExp(patt)

            const isMatch = exp.test(window.location.pathname)
            if (isMatch) {
                try {
                    return await route.handler(mdb, abortSignal)
                } catch (e) {
                    if (e === "abort") {
                        console.warn("Aborted route handler", route)
                        return async () => {}
                    } else {
                        throw e
                    }
                }
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
