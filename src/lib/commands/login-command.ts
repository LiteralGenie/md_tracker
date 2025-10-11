import { KV_URL, META_KEY } from "@/lib/constants"
import { Mdb } from "@/lib/db"
import { findKvSession } from "@/lib/utils/kv-utils"
import { postJson, query } from "@/lib/utils/misc-utils"
import { GM_registerMenuCommand } from "vite-plugin-monkey/dist/client"

export async function registerLoginCommand(mdb: Mdb) {
    const session = await findKvSession(mdb)

    const caption = session
        ? `Sync Server Login (${session.username})`
        : `Sync Server Login`

    GM_registerMenuCommand(
        caption,
        async (ev) => {
            const result = await promptLogin(session?.username)
            if (!result) return

            const update = await postJson(KV_URL + "/login", {
                username: result.username,
                password: result.password,
                duration: null,
            })
            console.log("Generated sync server session", update)

            await mdb.put("meta", update, META_KEY.KV_SESSION)

            window.location.href = window.location.href
        },
        {
            id: "login",
        }
    )
}

async function promptLogin(username?: string): Promise<null | {
    username: string
    password: string
}> {
    const host = document.createElement("div")
    host.id = "kv-login-container"
    document.body.appendChild(host)

    const shadow = host.attachShadow({ mode: "open" })

    shadow.innerHTML = /*html*/ `
        <style>
            dialog {
                max-width: 640px;
                padding: 1.5rem;
                border: none;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.8);
                font-family: system-ui, sans-serif;
                background: #1e1e1e;
                color: #f0f0f0;
                line-height: 1.5;
            }

            form {
                display: flex;
                flex-direction: column;
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
            }

            input::placeholder {
                color: #888;
            }

            input:focus {
                border-color: #e91e63;
                box-shadow: 0 0 0 2px rgba(233, 30, 99, 0.4);
            }

            menu {
                display: flex;
                justify-content: flex-end;
                gap: 0.6rem;
                margin-top: 0.5rem;
                margin-bottom: 0;
                padding: 0;
            }

            button {
                padding: 0.5rem 1rem;
                border: none;
                border-radius: 4px;
                font-size: 0.95rem;
                cursor: pointer;
            }

            #login {
                background: #e91e63; 
                color: #fff;
            }

            #login:hover {
                background: #c2185b;
            }

            #cancel {
                background: #444;
                color: #ddd;
            }

            #cancel:hover {
                background: #555;
            }

            h1, p {
                margin: 0;
            }

            h1 {
                font-size: 1.25em;
            }

            p {
                font-size: 0.8em;
                color: color-mix(
                    in oklab,
                    white,
                    transparent 20%
                );
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
        </style>

        <dialog>
            <form method="dialog">
                <h1>Sync Server Login</h1>

                <div class="v-space"></div> 

                ${
                    username
                        ? `
                            <p class="text-muted">
                                Currently logged in as ${username}
                            </p>

                            <div class="v-space"></div>
                        `
                        : ""
                }
                

                <p>
                    Database will be periodically synced to / from <a href="${KV_URL}">${KV_URL}</a>
                </p>
                                                        
                <p style="padding-top: 0.5em;">
                    <b>Note:</b> It's recommended to create a dedicated account solely for MangaDex data.
                    <br/>
                    It's unlikely but technically possible for other scripts on this page to access these credentials.
                </p>

                <div class="v-space"></div> 

                <div style="display: flex; flex-flow: column; gap: 1em;">
                    <label>
                        Username:
                        <input autofocus type="text" name="username" required>
                    </label> 

                    <label>
                        Password:
                        <input type="password" name="password" required>
                    </label>
                </div>

                <div class="v-space"></div> 

                <menu>
                    <button id="login" value="login" type="submit">Login</button>
                    <button id="cancel" type="button">Cancel</button>
                </menu>
            </form>
        </dialog>
    `
    const dialogEl = query<HTMLDialogElement>(shadow, "dialog")!
    dialogEl.showModal()

    const usernameEl = query<HTMLInputElement>(
        dialogEl,
        'input[name="username"]'
    )!
    const passwordEl = query<HTMLInputElement>(
        dialogEl,
        'input[name="password"]'
    )!

    if (username) {
        usernameEl.value = username
        usernameEl.focus()
    }

    const result: ReturnType<typeof promptLogin> = new Promise(
        (resolve, reject) => {
            // On cancel
            const cancelEl = query<HTMLButtonElement>(
                shadow,
                "#cancel"
            )!
            cancelEl.addEventListener("click", () => dialogEl.close())

            // On valid submit
            dialogEl.addEventListener("close", () => {
                if (dialogEl.returnValue === "login") {
                    const username = usernameEl.value
                    const password = passwordEl.value

                    return resolve({ username, password })
                } else {
                    resolve(null)
                }
            })
        }
    )

    result.then(() => {
        host.remove()
    })

    return result
}
