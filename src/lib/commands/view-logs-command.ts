import { APP_LOG, AppContext } from "@/app-context"
import { spawnDialog } from "@/lib/commands/command-utils"
import { query } from "@/lib/utils/misc-utils"
import { sleep } from "radash"
import { GM_registerMenuCommand } from "vite-plugin-monkey/dist/client"

export async function registerViewLogsCommand(ctx: AppContext) {
    GM_registerMenuCommand(
        "View Logs",
        async (ev) => {
            await showDialog(ctx)
        },
        {
            id: "log",
        }
    )
}

async function showDialog(ctx: AppContext): Promise<void> {
    const { hostEl, shadow, dialogEl } = spawnDialog({
        css: /*css*/ `
            dialog {
                max-width: 640px;
                max-height: 80%;
                display: flex;
                flex-flow: column;
            }

            pre {
                font-size: 0.75rem;
                overflow: auto;
            }

            menu {
                display: flex;
                justify-content: flex-end;
                gap: 0.6rem;
                margin-top: 0.5rem;
                margin-bottom: 0;
                padding: 0;
            }
        `,
        html: /*html*/ `
            <h1>MD Tracker Logs</h1>
            
            <pre></pre>

            <div class="v-space"></div>

            <menu>
                <button id="close" type="button">Close</button>
            </menu>
        `,
    })
    dialogEl.showModal()

    const logEl = query<HTMLPreElement>(dialogEl, "pre")!
    const cancelEl = query<HTMLButtonElement>(dialogEl, "#close")!

    let isCancelled = false
    const monitorTask = (async () => {
        while (!isCancelled) {
            logEl.textContent = APP_LOG.join("\n")
            await sleep(500)
        }
    })()

    const result: ReturnType<typeof showDialog> = new Promise(
        (resolve, reject) => {
            // On cancel
            cancelEl.addEventListener("click", () => {
                resolve()
            })
        }
    )

    result.then(() => {
        isCancelled = true
        dialogEl.close()
        hostEl.remove()
    })

    return result
}
