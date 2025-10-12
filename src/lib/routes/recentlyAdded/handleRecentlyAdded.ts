import { AppContext } from "@/app-context"
import { MdId } from "@/lib/db"
import {
    fetchMdTitlesSeen$,
    MdTitlesSeen,
} from "@/lib/md/fetch-titles-seen"
import { fetchMdFollows, MdFollows } from "@/lib/md/md-utils"
import { BehaviorSubject } from "@/lib/rx/behavior-subject"
import { rx } from "@/lib/rx/rx"
import { fromMutationObserver, mergeAll } from "@/lib/rx/rx-utils"
import {
    debounceUntilSettled,
    query,
    queryAll,
} from "@/lib/utils/misc-utils"
import "./recentlyAdded.css"

export async function handleRecentlyAdded(
    ctx: AppContext,
    abortSignal: AbortSignal
) {
    // Rerun when follows are fetched
    const follows$ = new rx.BehaviorSubject<MdFollows | null>(null)
    follows$.name = "follow"
    const tokenSub = ctx.mdToken$.subscribeAsync(async (mdToken) => {
        if (mdToken && !follows$.value) {
            follows$.set(await fetchMdFollows(ctx.mdb, mdToken))
        }
    })

    // Rerun when MD finishes fetching stats
    const [mutation$, observer] = fromMutationObserver(
        {
            target: document.body,
            subtree: true,
            childList: true,
            characterData: true,
        },
        () => {}
    )
    mutation$.name = "mutation"

    // Rerun as titles-seen data is generated (from reading history + md api fetches)
    let titlesSeenTask: Promise<unknown> | null = null
    if (!ctx.data.titlesSeen$) {
        ctx.data.titlesSeen$ = new BehaviorSubject<MdTitlesSeen>({})
    }
    const tokenSub2 = ctx.mdToken$.subscribeAsync(async (mdToken) => {
        if (mdToken && !titlesSeenTask) {
            titlesSeenTask = fetchMdTitlesSeen$({
                data$: ctx.data.titlesSeen$!,
                mdb: ctx.mdb,
                mdToken: mdToken,
                abortSignal,
            })
        }
    })

    const change$ = mergeAll(
        mutation$,
        follows$,
        ctx.data.titlesSeen$!
    )
    const changeSub = change$.subscribe(
        debounceUntilSettled({
            interval: 300,
            fn: ([mutation, follows, titlesSeen, { source }]) => {
                handleMutation(follows, titlesSeen)
            },
        })
    )

    return async () => {
        observer.disconnect()
        tokenSub.unsubscribe()
        tokenSub2.unsubscribe()
        changeSub.unsubscribe()
    }

    async function handleMutation(
        follows: MdFollows | null,
        titlesSeen: MdTitlesSeen
    ) {
        const page = parsePage()
        console.log("Parsed page", page)

        for (const item of page) {
            const hasBlacklistedTag = item.tags.some(({ name }) =>
                ctx.config.tagsBlacklist.has(name.toLocaleLowerCase())
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

        for (const item of page) {
            const numChapsRead =
                titlesSeen[item.title.id]?.chapters.size ?? 0
            if (
                numChapsRead >= ctx.config.chaptersPerTitleThreshold
            ) {
                console.log("Spotted read", numChapsRead, item)
                item.el.classList.add("mute")
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
    comments: number | null
    rating: number | null
    follows: number | null
    status: string | null
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

            let follows = parseInt(
                query(
                    cardEl,
                    ".stat:nth-child(2)"
                )!.textContent!.replace(",", "")
            )

            const status =
                query(cardEl, ".status")?.textContent ?? null

            return {
                el: cardEl,
                title: {
                    id,
                    name,
                },
                description,
                tags,
                comments,
                rating: isNaN(rating) ? null : rating,
                follows: isNaN(follows) ? null : follows,
                status,
            }
        }
    )
}
