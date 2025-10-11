import { AppContext } from "@/app-context"
import { spawnDialog } from "@/lib/commands/command-utils"
import { ConfigOut, validateConfig, writeConfig } from "@/lib/config"
import { findKvSession } from "@/lib/utils/kv-utils"
import { query } from "@/lib/utils/misc-utils"
import { GM_registerMenuCommand } from "vite-plugin-monkey/dist/client"
import { ZodError } from "zod"

export async function registerConfigCommand(ctx: AppContext) {
    const session = await findKvSession(ctx.mdb)

    GM_registerMenuCommand(
        "Edit Config",
        async (ev) => {
            const config = await showEditDialog(ctx)

            if (config) {
                await writeConfig(ctx.mdb, config)
                window.location.href = window.location.href
            }
        },
        {
            id: "config",
        }
    )
}

async function showEditDialog(
    ctx: AppContext
): Promise<ConfigOut | null> {
    const { hostEl, shadow, dialogEl } = spawnDialog({
        css: /*css*/ `
            dialog {
                max-width: 640px;
            }

            form {
                display: flex;
                flex-direction: column;
            }

            .field-list {
                display: flex;
                flex-direction: column;
            }

            .field-list hr {
                margin: 1.5rem 0.125rem;
                border: 1px solid rgba(255,255,255, 10%);
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

            .description {
                font-size: 0.75rem;
                color: var(--muted);
                line-height: 1.35;
                margin-top: 4px;
            }

            label {
                font-size: 0.9rem;
                color: var(--accent);
            }

            input {
                font-size: 0.9rem;
                width: 100%;
            }

            .field.checkbox {
                display: grid;
                grid-template-areas: 
                    "control title"
                    "description description"
                ;
                grid-template-columns: max-content 1fr;
                align-items: center;
            }
            .field.checkbox input {
                grid-area: control;
                margin: 0;
                margin-right: 0.375rem;
                justify-self: center;
                align-self: center;
            }
            .field.checkbox label {
                grid-area: title;
            }
            .field.checkbox .description {
                grid-area: description;
            }
        `,
        html: /*html*/ `
            <form>
                <h1>MD Tracker Config</h1>

                <div class="v-space"></div>

                <div class="field-list">
                    <div class="field">
                        <label for="tags-blacklist">Tags Blacklist</label>
                        <input
                            id="tags-blacklist"
                            type="text"
                            placeholder="oneshot, long strip" 
                        />
                        <p class="description">Hide series containing any of these tags. Tags should be separated by commas. Tags are not case-sensitive.</p>
                    </div>

                    <hr />

                    <div class="field">
                        <label for="sync-url">Sync Server URL (optional)</label>
                        <input
                            id="sync-url"
                            type="text"
                            placeholder="https://kv.mydomain.com" 
                        />
                        <p class="description">
                            URL for
                            <a href="https://github.com/LiteralGenie/simple_kv">https://github.com/LiteralGenie/simple_kv</a>.
                            Used for syncing reading history and other data across devices.
                        </p>
                    </div>

                    <hr />

                    <div class="field checkbox">
                        <label for="tweak-styles">Tweak manga card styles</label>
                        <input
                            id="tweak-styles"
                            type="checkbox"
                        />
                    </div>
                </div>

                <div class="v-space"></div>

                <div class="error-container">
                    <p> </p>
                    <div class="v-space"></div>
                </div>

                <div class="v-space"></div>

                <menu>
                    <button id="save" type="submit" class="primary">Save</button>
                    <button id="close" type="button">Close</button>
                </menu>
            </form>
        `,
    })
    dialogEl.showModal()

    const formEl = query<HTMLFormElement>(shadow, "form")!
    const submitEl = query<HTMLButtonElement>(dialogEl, "#save")!
    const cancelEl = query<HTMLButtonElement>(dialogEl, "#close")!
    const errorContainerEl = query<HTMLElement>(
        dialogEl,
        ".error-container"
    )!
    const errorTextEl = query<HTMLElement>(
        dialogEl,
        ".error-container p"
    )!

    const tagsBlacklistEl = query<HTMLInputElement>(
        formEl,
        "#tags-blacklist"
    )!
    tagsBlacklistEl.value = [...ctx.config.tagsBlacklist].join(", ")

    const syncServerEl = query<HTMLInputElement>(formEl, "#sync-url")!
    syncServerEl.value = ctx.config.syncServerUrl ?? ""

    const tweakCardStylesEl = query<HTMLInputElement>(
        formEl,
        "#tweak-styles"
    )!
    if (ctx.config.tweakCardStyles) {
        tweakCardStylesEl.click()
    }

    const result: ReturnType<typeof showEditDialog> = new Promise(
        (resolve, reject) => {
            // On cancel
            cancelEl.addEventListener("click", () => {
                resolve(null)
            })

            // On submit
            formEl.addEventListener("submit", async (ev) => {
                ev.preventDefault()

                try {
                    hideError()

                    const config = validateConfig({
                        tagsBlacklist: tagsBlacklistEl
                            .value!.trim()
                            .split(","),
                        syncServerUrl:
                            syncServerEl.value!.trim() || null,
                        tweakCardStyles: tweakCardStylesEl.checked,
                    })

                    console.log("Updating config to", config)

                    resolve(config)
                } catch (e) {
                    let errorText
                    if (e instanceof ZodError) {
                        errorText = e.issues
                            .map((x) => x.message)
                            .join("\n")
                    } else {
                        console.error(e)
                        errorText = String(e)
                    }

                    showError(errorText)
                }
            })
        }
    )

    result.then(() => {
        dialogEl.close()
        hostEl.remove()
    })

    return result

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
