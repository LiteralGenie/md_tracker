import { ConfigOut } from "@/lib/config"
import { Mdb } from "@/lib/db"
import { GM_registerMenuCommand } from "vite-plugin-monkey/dist/client"

export async function registerConfigCommand(
    config: ConfigOut,
    mdb: Mdb
) {
    const session = await findKvSession(mdb)

    GM_registerMenuCommand(
        E,
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
