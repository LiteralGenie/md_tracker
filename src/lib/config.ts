import { META_KEY } from "@/lib/constants"
import { Mdb } from "@/lib/db"
import z from "zod"

export type ConfigIn = z.input<typeof CONFIG_SCHEMA>
export type ConfigOut = z.output<typeof CONFIG_SCHEMA>

const CONFIG_SCHEMA = z.object({
    tagsBlacklist: z
        .array(
            z.string().transform((x) => x.toLocaleLowerCase()),
            {}
        )
        .transform((xs) => new Set(xs)),
})

const DEFAULT_CONFIG = () =>
    ({
        tagsBlacklist: [],
    } satisfies ConfigIn)

export async function loadConfig(mdb: Mdb) {
    let configRaw: ConfigIn | null = await mdb.get(
        "meta",
        META_KEY.CONFIG
    )

    let needsUpdate = false
    if (!configRaw) {
        configRaw = DEFAULT_CONFIG()
        needsUpdate = true
    }

    let config: ConfigOut
    try {
        config = z.parse(CONFIG_SCHEMA, configRaw)
    } catch (e) {
        console.error("Ignoring invalid config", configRaw)

        configRaw = DEFAULT_CONFIG()
        needsUpdate = true

        config = z.parse(CONFIG_SCHEMA, configRaw)
    }

    if (needsUpdate) {
        writeConfig(mdb, config)
    }

    return config
}

export async function writeConfig(mdb: Mdb, config: ConfigOut) {
    const afterSerialize: ConfigIn = {
        tagsBlacklist: [...config.tagsBlacklist],
    }

    await mdb.put("meta", afterSerialize, META_KEY.CONFIG)
}
