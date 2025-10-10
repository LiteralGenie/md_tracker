import { Mdb } from "@/lib/db"
import { nowIso } from "@/lib/utils/misc_utils"

export type MdFollows = Record<
    string,
    | "reading"
    | "completed"
    | "dropped"
    | "on_hold"
    | "plan_to_read"
    | "re_reading"
>

export async function fetchMdFollows(
    mdb: Mdb
): Promise<MdFollows | null> {
    const resp = await fetchMdApiCache<{ statuses: MdFollows }>(
        mdb,
        "/manga/status",
        "/manga/status",
        {
            maxAgeMs: 600,
        }
    )

    return resp?.statuses ?? null
}

export async function fetchMdApi<T = unknown>(
    path: string
): Promise<T | null> {
    const authInfo = localStorage.getItem(
        "oidc.user:https://auth.mangadex.org/realms/mangadex:mangadex-frontend-stable"
    )
    const token = JSON.parse(authInfo ?? "{}").access_token
    if (!token) {
        console.error("No MD token found")
        return null
    }

    console.log("Fetching", path)
    const resp = await fetch("https://api.mangadex.org" + path, {
        headers: {
            Authorization: "Bearer " + token,
        },
    })
    if (resp.status !== 200) {
        console.error(`Fetch for ${path} failed`)
        return null
    }

    return await resp.json()
}

interface FetchMdApiCacheOptions {
    maxAgeMs: number
}

async function fetchMdApiCache<T = unknown>(
    mdb: Mdb,
    storage_key: string,
    path: string,
    opts: FetchMdApiCacheOptions
): Promise<T | null> {
    const fromStorage = await mdb.get("md_api", storage_key)

    let data = fromStorage?.data ?? null

    if (data) {
        const age =
            new Date(nowIso()).getTime() -
            new Date(data.updatedAt).getTime()
        if (age > (opts?.maxAgeMs ?? 600)) {
            data = null
        }
    }

    if (!data) {
        data = await fetchMdApi(path)
        if (!data) {
            return null
        }
    }

    await mdb.put("md_api", {
        id: storage_key,
        data,
        updatedAt: nowIso(),
    })

    return data
}
