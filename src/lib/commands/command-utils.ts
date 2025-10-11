import { query } from "@/lib/utils/misc-utils"

export interface SpawnDialogOpts {
    html: string
    css: string
}

export function spawnDialog(opts: SpawnDialogOpts) {
    const hostEl = document.createElement("div")
    hostEl.id = "kv-login-container"
    document.body.appendChild(hostEl)

    const shadow = hostEl.attachShadow({ mode: "open" })

    shadow.innerHTML = /*html*/ `
        <style>
            dialog {
                padding: 1.5rem;
                border: none;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.8);
                font-family: system-ui, sans-serif;
                background: #1e1e1e;
                color: #f0f0f0;
                line-height: 1.5;
            }

            ${opts.css}
        </style>

        <dialog>
            ${opts.html}
        </dialog>
    `

    const dialogEl = query<HTMLDialogElement>(shadow, "dialog")!
    return { hostEl, shadow, dialogEl }
}
