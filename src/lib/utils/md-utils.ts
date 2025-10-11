import { Mdb, MdId } from "@/lib/db"
import { enumerate, nowIso } from "@/lib/utils/misc-utils"
import { sleep } from "radash"

export type MdTitlesSeen = Record<
    MdId,
    {
        title: MdId
        chapters: Set<MdId>
    }
>

export interface FetchMdSeenTitlesOpts {
    mdb: Mdb
    mdToken: string
    abortSignal?: AbortSignal
    onlyCache: boolean
}

export async function fetchMdSeenTitles(
    opts: FetchMdSeenTitlesOpts
): Promise<MdTitlesSeen> {
    const seen: MdTitlesSeen = {}
    const done = new Set<string>()

    const chapterToTitle = await opts.mdb.getAll(
        "md_chapter_to_title"
    )
    for (const { chapter: cid, title: tid } of chapterToTitle) {
        seen[tid] = seen[tid] ?? {
            title: tid,
            chapters: new Set(),
        }
        seen[tid].chapters.add(cid)
        done.add(cid)
    }

    let lastProgressNotificataion = new Date().getTime()
    const history = await opts.mdb.getAll("chapter_history")
    for (const [idx, r] of enumerate(history)) {
        const elapsed =
            new Date().getTime() - lastProgressNotificataion
        if (elapsed > 5000) {
            lastProgressNotificataion = new Date().getTime()
            console.log(
                `Fetching metadata for chapter history (${
                    idx + 1
                } / ${history.length}) ...`
            )
        }

        if (done.has(r.cid)) {
            continue
        }

        const chapter = (await fetchMdApiCache<any>(
            opts.mdb,
            `/chapter/${r.cid}`,
            opts.mdToken,
            `/chapter/${r.cid}`,
            {
                maxAgeMs: 365 * 86400 * 1000,
                sleepMs: 250,
                onlyCache: opts.onlyCache,
            }
        )) as null | {
            data: {
                attributes: {}
                id: MdId
                relationships: Array<{
                    id: MdId
                    type: string
                }>
            }
        }

        if (!chapter) {
            console.warn(`Unknown chapter ${r.cid}`)
            continue
        }

        const tid = chapter.data.relationships.find(
            (x) => x.type === "manga"
        )!.id
        await opts.mdb.put("md_chapter_to_title", {
            chapter: r.cid,
            title: tid,
        })

        seen[tid] = seen[tid] ?? {
            title: tid,
            chapters: new Set(),
        }
        seen[tid].chapters.add(r.cid)

        opts.abortSignal?.throwIfAborted()
    }

    return seen
}

export type MdFollows = Record<
    MdId,
    | "reading"
    | "completed"
    | "dropped"
    | "on_hold"
    | "plan_to_read"
    | "re_reading"
>

export async function fetchMdFollows(
    mdb: Mdb,
    mdToken: string
): Promise<MdFollows | null> {
    const resp = await fetchMdApiCache<{ statuses: MdFollows }>(
        mdb,
        "/manga/status",
        mdToken,
        "/manga/status",
        {
            maxAgeMs: 600 * 1000,
        }
    )

    return resp?.statuses ?? null
}

export function findMdToken(): string | null {
    const authInfo = localStorage.getItem(
        "oidc.user:https://auth.mangadex.org/realms/mangadex:mangadex-frontend-stable"
    )
    const token = JSON.parse(authInfo ?? "{}").access_token
    if (!token) {
        console.error("No MD token found")
        return null
    }

    return token
}

export async function fetchMdApi<T = unknown>(
    path: string,
    token: string
): Promise<T> {
    console.log("Fetching", path)
    const resp = await fetch("https://api.mangadex.org" + path, {
        headers: {
            Authorization: "Bearer " + token,
        },
    })
    // if (resp.status !== 200) {
    //     console.error(`Fetch for ${path} failed`)
    //     return null
    // }

    return await resp.json()
}

interface FetchMdApiCacheOptions {
    maxAgeMs: number
    sleepMs?: number
    onlyCache?: boolean
}

/**
 *
 * @param mdb
 * @param storageKey
 * @param path
 * @param opts
 * @returns response if successful, null on error
 */
async function fetchMdApiCache<T = unknown>(
    mdb: Mdb,
    storageKey: string,
    mdToken: string,
    path: string,
    opts: FetchMdApiCacheOptions
): Promise<T | null> {
    const fromStorage = await mdb.get("md_api", storageKey)
    let data = fromStorage?.data ?? null

    // Check expiry
    let isExpired = false
    if (data) {
        const age =
            new Date(nowIso()).getTime() -
            new Date(data.updatedAt).getTime()
        if (age > (opts?.maxAgeMs ?? 600)) {
            isExpired = true
        }
    }

    // Fetch and cache
    if ((!data || isExpired) && !opts.onlyCache) {
        if (opts?.sleepMs) {
            await sleep(opts.sleepMs)
        }

        data = await fetchMdApi(path, mdToken)

        await mdb.put("md_api", {
            id: storageKey,
            data,
            updatedAt: nowIso(),
        })
    }

    // Simplify errors to null
    if (data && data.result !== "ok") {
        if (data.errors?.[0]?.status !== 404) {
            console.error("MD request failed", data)
        }

        return null
    }

    return data
}
