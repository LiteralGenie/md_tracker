import { Mdb } from "@/lib/db"
import { fetchMdFollows } from "@/lib/utils/md_utils"
import { query, queryAll } from "@/lib/utils/misc_utils"
import { sleep } from "radash"
import "./recentlyAdded.css"

export async function handleRecentlyAdded(mdb: Mdb) {
    let page: RecentlyAddedItem[] = []
    while (page.length === 0) {
        page = parsePage()
        await sleep(100)
    }

    const follows = await fetchMdFollows(mdb)
    if (follows) {
        for (const item of page) {
            if (item.id in follows) {
                console.log("Spotted follow", follows[item.id], item)
                item.el.classList.add("seen")
            }
        }
    }

    return async () => {}
}

export interface RecentlyAddedItem {
    el: HTMLElement
    id: string
    title: string
    description: string
    tags: Array<{
        id: string
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
            const titleEl = query<HTMLAnchorElement>(
                cardEl,
                ".title"
            )!
            const title = titleEl.textContent!
            const id = titleEl.href.match(
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

            const follows = parseFloat(
                query(cardEl, ".stat:nth-child(2)")!.textContent!
            )

            const status = query(cardEl, ".status")!.textContent!

            return {
                el: cardEl,
                id,
                title,
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
