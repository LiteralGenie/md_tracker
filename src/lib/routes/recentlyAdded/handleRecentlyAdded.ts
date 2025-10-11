import { CONFIG } from "@/config"
import { Mdb, MdId } from "@/lib/db"
import {
    fetchMdFollows,
    fetchMdSeenTitles,
    findMdToken,
} from "@/lib/utils/md-utils"
import {
    debounceUntilSettled,
    query,
    queryAll,
} from "@/lib/utils/misc-utils"
import { MaybeReturnAsync } from "@/lib/utils/type-utils"
import "./recentlyAdded.css"

export async function handleRecentlyAdded(
    mdb: Mdb,
    abortSignal: AbortSignal
) {
    const mdToken = findMdToken()

    let follows = null as MaybeReturnAsync<typeof fetchMdFollows>
    let seen = null as MaybeReturnAsync<typeof fetchMdSeenTitles>
    if (mdToken) {
        follows = await fetchMdFollows(mdb, mdToken)

        // Mapping chapter id to title id can take a while,
        // so just make do with whatever's in cache
        // and run the update in background, letting it take effect next refresh
        const seenOpts = {
            mdb,
            mdToken,
            abortSignal,
            onlyCache: true,
        }
        seen = await fetchMdSeenTitles(seenOpts)
    }

    const observer = new MutationObserver(
        debounceUntilSettled({
            fn: handleMutation,
            interval: 300,
        })
    )
    observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
    })

    handleMutation()

    return async () => {
        observer.disconnect()
    }

    async function handleMutation() {
        const page = parsePage()
        console.log("Parsed page", page)

        for (const item of page) {
            const hasBlacklistedTag = item.tags.some(({ name }) =>
                CONFIG.TAGS_BLACKLIST.has(name)
            )
            if (hasBlacklistedTag) {
                item.el.classList.add("mute")
            }
        }

        if (follows) {
            for (const item of page) {
                if (item.title.id in follows) {
                    console.log(
                        "Spotted follow",
                        follows[item.title.id],
                        item
                    )
                    item.el.classList.add("mute")
                }
            }
        }

        if (seen) {
            for (const item of page) {
                const numChapsRead =
                    seen[item.title.id]?.chapters.size ?? 0
                if (numChapsRead >= 2) {
                    console.log("Spotted read", numChapsRead, item)
                    item.el.classList.add("mute")
                }
            }
        }
    }
}

export interface RecentlyAddedItem {
    el: HTMLElement
    title: {
        id: MdId
        name: string
    }
    description: string
    tags: Array<{
        id: MdId
        name: string
    }>
    comments: number
    rating: number
    follows: number
    status: string
}

function parsePage(): RecentlyAddedItem[] {
    return queryAll<HTMLElement>(document, ".manga-card").map(
        (cardEl) => {
            const nameEl = query<HTMLAnchorElement>(cardEl, ".title")!
            const name = nameEl.textContent!
            const id = nameEl.href.match(
                /\/title\/([a-z0-9\-]+)\//i
            )![1]

            const description = query(cardEl, ".description")!
                .textContent!

            const tags = queryAll<HTMLAnchorElement>(
                cardEl,
                ".tags > a"
            ).map((tagEl) => ({
                id: tagEl.href.match(/\/tag\/([a-z0-9\-]+)\//i)![1],
                name: tagEl.textContent!,
            }))

            const comments = parseInt(
                query(cardEl, ".comment-container > span")
                    ?.textContent ?? "0"
            )

            const rating = parseFloat(
                query(cardEl, ".stat:nth-child(1)")!.textContent!
            )

            const follows = parseInt(
                query(
                    cardEl,
                    ".stat:nth-child(2)"
                )!.textContent!.replace(",", "")
            )

            const status = query(cardEl, ".status")!.textContent!

            return {
                el: cardEl,
                title: {
                    id,
                    name,
                },
                description,
                tags,
                comments,
                rating,
                follows,
                status,
            }
        }
    )
}
