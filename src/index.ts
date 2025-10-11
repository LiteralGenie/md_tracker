import { registerMenuCommands } from "@/lib/register-menu-commands"
import { handleRecentlyAdded } from "@/lib/routes/recentlyAdded/handleRecentlyAdded"

type AsyncCleanup = () => Promise<void>

import "@/app.css"
import { AppContext, initAppContext } from "@/appContext"

async function main() {
    const ctx = await initAppContext()

    // Append our css to <head>
    window.MD_TRACKER.initCss()

    // Add buttons to userscript manager
    registerMenuCommands(ctx)

    // MD is a SPA so listen for url changes
    hookNavigation()

    let currAborter = new AbortController()
    let currHandler = onNavigation(currAborter.signal)

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

    async function onNavigation(
        abortSignal: AbortSignal
    ): Promise<AsyncCleanup> {
        const routeCleanup = await doRouting(ctx, abortSignal)

        return async () => {
            await routeCleanup()
        }
    }
}

const ROUTES = [
    {
        patts: ["/titles/recent"],
        handler: handleRecentlyAdded,
    },
]

async function doRouting(
    ctx: AppContext,
    abortSignal: AbortSignal
): Promise<AsyncCleanup> {
    for (const route of ROUTES) {
        for (const patt of route.patts) {
            const exp = new RegExp(patt)

            const isMatch = exp.test(window.location.pathname)
            if (isMatch) {
                try {
                    return await route.handler(ctx, abortSignal)
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
