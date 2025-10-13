import { META_KEY } from "@/lib/constants"
import { Mdb } from "@/lib/db"
import * as z from "zod/mini"

export type ConfigIn = z.input<typeof CONFIG_SCHEMA>
export type ConfigOut = z.output<typeof CONFIG_SCHEMA>

const CONFIG_SCHEMA = z.object({
    tagsBlacklist: z.pipe(
        z.array(
            z.pipe(
                z.string(),
                z.transform((x) => x.toLocaleLowerCase().trim())
            )
        ),
        z.transform((xs) => new Set(xs.filter((x) => x.length > 0)))
    ),

    syncServerUrl: z.nullable(
        z.pipe(
            z.url({
                normalize: true,
            }),
            z.transform((url) =>
                url.endsWith("/")
                    ? url.substring(0, url.length - 1)
                    : url
            )
        )
    ),

    tweakCardStyles: z.boolean(),

    chaptersPerTitleThreshold: z.int(),
})

const DEFAULT_CONFIG = () =>
    ({
        tagsBlacklist: [],
        syncServerUrl: null,
        tweakCardStyles: true,
        chaptersPerTitleThreshold: 2,
    } satisfies ConfigIn)

export async function loadConfig(mdb: Mdb) {
    let configRaw: ConfigIn = {
        ...DEFAULT_CONFIG(),
        ...(await mdb.get("meta", META_KEY.CONFIG)),
    }

    let config: ConfigOut
    try {
        config = z.parse(CONFIG_SCHEMA, configRaw)
    } catch (e) {
        console.error("Ignoring invalid config", configRaw)

        configRaw = DEFAULT_CONFIG()
        config = z.parse(CONFIG_SCHEMA, configRaw)
        writeConfig(mdb, config)
    }

    return config
}

export async function writeConfig(mdb: Mdb, config: ConfigOut) {
    const afterSerialize: ConfigIn = {
        ...config,
        tagsBlacklist: [...config.tagsBlacklist],
    }

    await mdb.put("meta", afterSerialize, META_KEY.CONFIG)
}

export function validateConfig(config: ConfigIn): ConfigOut {
    return z.parse(CONFIG_SCHEMA, config)
}
