import { AppContext } from "@/app-context"
import { spawnDialog } from "@/lib/commands/command-utils"
import { META_KEY } from "@/lib/constants"
import { postJson, query } from "@/lib/utils/misc-utils"
import { GM_registerMenuCommand } from "vite-plugin-monkey/dist/client"

export async function registerLoginCommand(ctx: AppContext) {
    if (!ctx.config.syncServerUrl) {
        return
    }

    const caption = ctx.kv?.session
        ? `Sync Server Login (${ctx.kv.session.username})`
        : `Sync Server Login`

    GM_registerMenuCommand(
        caption,
        async (ev) => {
            const didLogin = await promptLogin(
                ctx,
                ctx.kv?.session.username
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
    ctx: AppContext,
    username?: string
): Promise<boolean> {
    const { hostEl, shadow, dialogEl } = spawnDialog({
        css: /*css*/ `
            dialog {
                max-width: 640px;
            }

            form {
                display: flex;
                flex-direction: column;
            }

            menu {
                display: flex;
                justify-content: flex-end;
                gap: 0.6rem;
                margin-top: 0.5rem;
                margin-bottom: 0;
                padding: 0;
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
                    <a href="${ctx.config.syncServerUrl}">${
            ctx.config.syncServerUrl
        }</a>
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
                    <button id="login" value="login" type="submit" class="primary">
                        Login
                    </button>
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

                const update = await postJson(
                    ctx.config.syncServerUrl + "/login",
                    {
                        username: usernameEl.value,
                        password: passwordEl.value,
                        duration: null,
                    }
                )
                console.log("Generated sync server session", update)

                await ctx.mdb.put("meta", update, META_KEY.KV_SESSION)

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
