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
            ${COMMON_CSS}

            /***/

            ${opts.css}
        </style>

        <dialog>
            ${opts.html}
        </dialog>
    `

    const dialogEl = query<HTMLDialogElement>(shadow, "dialog")!
    return { hostEl, shadow, dialogEl }
}

const COMMON_CSS = /*css*/ `
    dialog {
        padding: 1.5rem;
        border: none;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.8);
        font-family: system-ui, sans-serif;
        background: #1e1e1e;
        color: #f0f0f0;
        line-height: 1.5;
        width: 80%;
        height: 80%;
        overflow: auto;
    }

    label {
        display: flex;
        flex-direction: column;
        font-size: 0.95rem;
        font-weight: 500;
        color: #ddd;
    }

    input {
        margin-top: 0.4rem;
        padding: 0.5rem 0.6rem;
        border: 1px solid #555;
        border-radius: 4px;
        font-size: 1rem;
        outline: none;
        background: #2a2a2a;
        color: #f0f0f0;
        box-sizing: border-box;
    }

    input::placeholder {
        color: #888;
    }

    input:focus {
        border-color: #e91e63;
        box-shadow: 0 0 0 2px rgba(233, 30, 99, 0.4);
    }

    input[type="checkbox"] {
        accent-color: color-mix(
            in oklab,
            #e91e63,
            transparent 20%
        );
    }
    input[type="checkbox"]:hover {
        accent-color: #e91e63;
    }

    button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 4px;
        font-size: 0.95rem;
        cursor: pointer;
    }

    button {
        background: #444;
        color: #ddd;
        font-weight: bold;
    }

    button:hover {
        background: #555;
    }

    button.primary {
        background: #e91e63; 
        color: #fff;
    }

    button.primary:hover {
        background: #c2185b;
    }

    button:disabled, input:disabled {
        opacity: 0.5;
        pointer-events: none;
    }

    h1, p {
        margin: 0;
    }

    h1 {
        font-size: 1.25em;
    }

    .v-space {
        height: 1em;
    }

    .text-muted {
        color: color-mix(
            in oklab,
            white,
            transparent 40%
        );
    }
`
