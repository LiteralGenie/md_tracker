import { Mdb, MdId } from "@/lib/db"
import { BehaviorSubject } from "@/lib/rx/behavior-subject"
import { nowIso } from "@/lib/utils/misc-utils"
import { ISODate } from "@/lib/utils/type-utils"
import { sleep } from "radash"

const MD_FETCH_LIMIT_PER_SECOND = 3

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

export function findMdLanguages(): string[] {
    const mdRaw = localStorage.getItem("md")
    const md = JSON.parse(mdRaw ?? "{}")

    const languages = md?.userPreferences?.filteredLanguages ?? []
    if (languages.length === 0) {
        languages.push("en")
    }

    return languages
}

export async function fetchMdApi<T = unknown>(
    path: string,
    token: string | null
): Promise<T> {
    console.log("Fetching", path)

    const headers = {} as Record<string, string>

    if (token) {
        headers["Authorization"] = "Bearer " + token
    }

    const resp = await fetch("https://api.mangadex.org" + path, {
        headers,
    })
    // if (resp.status !== 200) {
    //     console.error(`Fetch for ${path} failed`)
    //     return null
    // }

    return await resp.json()
}

interface FetchMdApiCacheOptions {
    maxAgeMs: number
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
export async function fetchMdApiCache<T = unknown>(
    mdb: Mdb,
    storageKey: string,
    mdToken: string | null,
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
        await waitForRateLimit()

        data = await fetchMdApi(path, mdToken)

        await mdb.put("md_api", {
            id: storageKey,
            data,
            updatedAt: nowIso(),
        })

        await mdb.put("md_api_replication_history", {
            id: storageKey,
            isReplicated: 0,
            fromRemote: false,
            updatedAt: new Date().toISOString(),
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

let mdFetch$ = new BehaviorSubject({
    queue: [] as Symbol[],
    history: [] as number[],
})

async function waitForRateLimit() {
    const self = Symbol()

    let { promise, resolve } = Promise.withResolvers()
    mdFetch$.value.queue.push(self)
    mdFetch$.refresh()

    const sub = mdFetch$.subscribeAsync(
        async ({ queue, history }) => {
            // queue[0] being self acts a lock that prevents
            // other subscribers from mutating history (but queue can still be appended to)
            if (queue[0] !== self) {
                return
            }

            if (history.length >= MD_FETCH_LIMIT_PER_SECOND) {
                const remDelay = 1000 - (Date.now() - history[0])
                if (remDelay > 0) {
                    await sleep(remDelay)
                }
                history.shift()
            }

            history.push(Date.now())

            queue.shift()
            mdFetch$.refresh()

            resolve(null)
        }
    )

    promise.then(() => {
        sub.unsubscribe()
    })

    return promise
}

export interface MdMangaFeed {
    data: Array<{
        id: MdId
        relationships: Array<
            | { type: "manga"; id: MdId }
            | {
                  type: "user"
                  id: MdId
                  attributes: {
                      username: string
                  }
              }
            | {
                  type: "scanlation_group"
                  id: string
                  attributes?: {
                      name: string
                  }
              }
        >
        attributes: {
            title: string
            volume: string
            chapter: string
            publishAt: ISODate
            pages: number
        }
    }>
}

export async function fetchMangaFeed(
    mdb: Mdb,
    langs: string[],
    tid: MdId
): Promise<MdMangaFeed | null> {
    const url = new URL("http://_")
    url.pathname = `/manga/${tid}/feed`

    for (const lang of langs) {
        url.searchParams.append("translatedLanguage[]", lang)
    }
    url.searchParams.append("limit", "100")
    url.searchParams.append("includes[]", "scanlation_group")
    url.searchParams.append("includes[]", "user")
    url.searchParams.append("order[volume]", "asc")
    url.searchParams.append("order[chapter]", "asc")
    url.searchParams.append("offset", "0")
    url.searchParams.append("contentRating[]", "safe")
    url.searchParams.append("contentRating[]", "suggestive")
    url.searchParams.append("contentRating[]", "erotica")
    url.searchParams.append("contentRating[]", "pornographic")
    url.searchParams.append("includeUnavailable", "0")
    // https://api.mangadex.org/manga/78037da5-fa73-463d-a8bb-9aecc8230787/feed
    // translatedLanguage=en
    // limit=100
    // includes[]=scanlation_group
    // includes[]=user
    // order[volume]=asc
    // order[chapter]=asc
    // offset=0
    // contentRating[]=safe
    // contentRating[]=suggestive
    // contentRating[]=erotica
    // contentRating[]=pornographic
    // includeUnavailable=0

    // https://api.mangadex.org/manga/78037da5-fa73-463d-a8bb-9aecc8230787/feed
    // translatedLanguage[]=en
    // translatedLanguage[]=ko
    // limit=96
    // includes[]=scanlation_group
    // includes[]=user
    // order[volume]=desc
    // order[chapter]=desc
    // offset=0
    // contentRating[]=safe
    // contentRating[]=suggestive
    // contentRating[]=erotica
    // contentRating[]=pornographic
    // includeUnavailable=0
    // excludeExternalUrl=blinktoon.com

    const pathWithSearch = url.pathname + url.search

    return fetchMdApiCache(
        mdb,
        pathWithSearch,
        null,
        pathWithSearch,
        {
            maxAgeMs: 3600 * 1000,
        }
    )
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
