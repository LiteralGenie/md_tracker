import { AppContext } from "@/appContext"
import { spawnDialog } from "@/lib/commands/command-utils"
import { KV_URL, META_KEY } from "@/lib/constants"
import { Mdb } from "@/lib/db"
import { findKvSession } from "@/lib/utils/kv-utils"
import { postJson, query } from "@/lib/utils/misc-utils"
import { GM_registerMenuCommand } from "vite-plugin-monkey/dist/client"

export async function registerLoginCommand(ctx: AppContext) {
    const session = await findKvSession(ctx.mdb)

    const caption = session
        ? `Sync Server Login (${session.username})`
        : `Sync Server Login`

    GM_registerMenuCommand(
        caption,
        async (ev) => {
            const didLogin = await promptLogin(
                ctx.mdb,
                session?.username
            )

            if (didLogin) {
                window.location.href = window.location.href
            }
        },
        {
            id: "login",
        }
    )
}

async function promptLogin(
    mdb: Mdb,
    username?: string
): Promise<boolean> {
    const { hostEl, shadow, dialogEl } = spawnDialog({
        css: /*css*/ `
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

            .error-container p {
                color: red;
            }
        `,
        html: /*html*/ `
            <form>
                <h1>Sync Server Login</h1>

                <div class="v-space"></div>

                ${
                    username
                        ? `
                <p class="text-muted">Currently logged in as ${username}</p>

                <div class="v-space"></div>
                `
                        : ""
                }

                <p>
                    Database will be periodically synced to / from
                    <a href="${KV_URL}">${KV_URL}</a>
                </p>

                <p style="padding-top: 0.5em">
                    <b>Note:</b> It's recommended to create a dedicated account
                    solely for MangaDex data.
                    <br />
                    It's unlikely but technically possible for other scripts on
                    this page to access these credentials.
                </p>

                <div class="v-space"></div>

                <div class="error-container">
                    <p> </p>
                    <div class="v-space"></div>
                </div>

                <div style="display: flex; flex-flow: column; gap: 1em">
                    <label>
                        Username:
                        <input autofocus type="text" name="username" required />
                    </label>

                    <label>
                        Password:
                        <input type="password" name="password" required />
                    </label>
                </div>

                <div class="v-space"></div>

                <menu>
                    <button id="login" value="login" type="submit">Login</button>
                    <button id="cancel" type="button">Cancel</button>
                </menu>
            </form>
        `,
    })
    dialogEl.showModal()

    const formEl = query<HTMLFormElement>(shadow, "form")!
    const usernameEl = query<HTMLInputElement>(
        dialogEl,
        'input[name="username"]'
    )!
    const passwordEl = query<HTMLInputElement>(
        dialogEl,
        'input[name="password"]'
    )!
    const submitEl = query<HTMLButtonElement>(dialogEl, "#login")!
    const cancelEl = query<HTMLButtonElement>(dialogEl, "#cancel")!
    const errorContainerEl = query<HTMLElement>(
        dialogEl,
        ".error-container"
    )!
    const errorTextEl = query<HTMLElement>(
        dialogEl,
        ".error-container p"
    )!

    if (username) {
        usernameEl.value = username
    }
    usernameEl.focus()

    return new Promise((resolve, reject) => {
        // On cancel
        cancelEl.addEventListener("click", () => {
            close()
            resolve(false)
        })

        // On submit
        formEl.addEventListener("submit", async (ev) => {
            ev.preventDefault()

            const toDisable = [
                usernameEl,
                passwordEl,
                submitEl,
                cancelEl,
            ]

            try {
                hideError()

                toDisable.forEach((el) => (el.disabled = true))

                const update = await postJson(KV_URL + "/login", {
                    username: usernameEl.value,
                    password: passwordEl.value,
                    duration: null,
                })
                console.log("Generated sync server session", update)

                await mdb.put("meta", update, META_KEY.KV_SESSION)

                close()
                resolve(true)
            } catch (e) {
                showError(e)
            } finally {
                toDisable.forEach((el) => (el.disabled = false))
            }
        })
    })

    function close() {
        dialogEl.close()
        hostEl.remove()
    }

    function showError(e: any) {
        console.error(e)
        errorContainerEl.style.display = "block"
        errorTextEl.textContent = String(e)
    }

    function hideError() {
        errorContainerEl.style.display = "none"
        errorTextEl.textContent = ""
    }
}
