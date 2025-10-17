import { Mdb, MdId } from "@/lib/db"
import { fetchMangaFeed, MdMangaFeed } from "@/lib/md/md-utils"
import { BehaviorSubject } from "@/lib/rx/behavior-subject"
import { enumerate, padNumber, query } from "@/lib/utils/misc-utils"
import { ISODate } from "@/lib/utils/type-utils"

export type FeedMapValue = Record<string, null | MdMangaFeed>
export type FeedMap$ = BehaviorSubject<FeedMapValue>

export function fetchChapters$(
    mdb: Mdb,
    langs: string[],
    tids: MdId[]
): FeedMap$ {
    const data$: FeedMap$ = new BehaviorSubject({})

    for (const tid of tids) {
        data$.value[tid] = null

        fetchMangaFeed(mdb, langs, tid).then((d) => {
            data$.value[tid] = d!
            data$.refresh()
        })
    }

    return data$
}

export async function renderChapterList(
    cardEl: HTMLElement,
    feed: MdMangaFeed,
    chaptersRead: Iterable<MdId>
) {
    let el = query(cardEl, ".mdt-chapter-list")
    if (!el) {
        el = document.createElement("div")
        el.classList.add("mdt-chapter-list")

        for (const [idx, ch] of enumerate(feed.data)) {
            const chEl = document.createElement("div")
            el.appendChild(chEl)

            if (idx < feed.data.length - 1) {
                const hrEl = document.createElement("hr")
                el.appendChild(hrEl)
            }

            let title
            if (ch.attributes.chapter !== null) {
                const vol = ch.attributes.volume
                    ? `Vol ${ch.attributes.volume}`
                    : null

                const chNum = `Ch ${ch.attributes.chapter}`

                const chTitle = ch.attributes.title
                    ? `${ch.attributes.title}`
                    : null

                title = ""
                if (vol) {
                    title += vol
                    title += ", " + chNum
                } else {
                    title += chNum
                }

                if (chTitle) {
                    title += " - " + chTitle
                }
            } else if (ch.attributes.title) {
                title = ch.attributes.title
            } else {
                title = "Oneshot"
            }

            const user = ch.relationships.find(
                (x) => x.type === "user"
            )!

            const group = ch.relationships.find(
                (x) => x.type === "scanlation_group"
            )
            const groupElHtml = group?.attributes?.name
                ? `<div class="mdt-group"> ${group.attributes.name} </div>`
                : ""

            chEl.outerHTML = /*html*/ `
            <a
                class="mdt-chapter-container"
                href="https://mangadex.org/chapter/${ch.id}"
                target="_blank"
                data-cid="${ch.id}"
            >
                <div class="mdt-chapter">
                    <div class="mdt-title"> ${title} </div>
                    <div class="mdt-user"> ${
                        user.attributes.username
                    } </div>
                    ${groupElHtml}
                    <div class="mdt-date"> ${formatDate(
                        ch.attributes.publishAt
                    )} </div>
                </div>
            </a>
        `
        }

        const containerEl = query(cardEl, ".description")!
        containerEl.appendChild(el)

        // Fix extraneous border
        const descriptionEl = query(cardEl, ".md-md-container")
        if (
            descriptionEl &&
            (descriptionEl.textContent?.length ?? 0) === 0
        ) {
            descriptionEl.classList.add("empty")
        }
    }

    for (const cid of chaptersRead) {
        const chEl = query(el, `[data-cid="${cid}"]`)
        chEl?.classList.add("mute")
    }
}

function formatDate(date: ISODate) {
    const d = new Date(date)

    const elapsed = Date.now() - d.getTime()

    if (elapsed < 86400 * 1000) {
        const hoursElapsed = Math.round(elapsed / (3600 * 1000))
        const unit = hoursElapsed > 1 ? "hours" : "hour"
        return `${hoursElapsed} ${unit} ago`
    } else if (elapsed < 10 * 86400 * 1000) {
        const daysElapsed = Math.floor(elapsed / (86400 * 1000))
        const unit = daysElapsed > 1 ? "days" : "day"
        return `${daysElapsed} ${unit} ago`
    } else {
        const year = d.getFullYear()
        const month = padNumber(d.getMonth() + 1, 2)
        const day = padNumber(d.getDate(), 2)
        return `${year}-${month}-${day}`
    }
}
