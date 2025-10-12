import { Mdb, MdId } from "@/lib/db"
import { fetchMdApiCache } from "@/lib/md/md-utils"
import { BehaviorSubject } from "@/lib/rx/behavior-subject"
import { enumerate } from "@/lib/utils/misc-utils"
import { sleep } from "radash"

export type MdTitlesSeen = Record<
    MdId,
    {
        title: MdId
        chapters: Set<MdId>
    }
>

export interface FetchTitlesSeenOpts {
    data$: BehaviorSubject<MdTitlesSeen>
    mdb: Mdb
    mdToken: string
    abortSignal?: AbortSignal
}

export async function fetchMdTitlesSeen$(opts: FetchTitlesSeenOpts) {
    const done = new Set<string>()

    const chapterToTitle = await opts.mdb.getAll(
        "md_chapter_to_title"
    )
    for (const { chapter: cid, title: tid } of chapterToTitle) {
        opts.data$.value[tid] = opts.data$.value[tid] ?? {
            title: tid,
            chapters: new Set(),
        }
        opts.data$.value[tid].chapters.add(cid)
        opts.data$.set(opts.data$.value)

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

        opts.data$.value[tid] = opts.data$.value[tid] ?? {
            title: tid,
            chapters: new Set(),
        }
        opts.data$.value[tid].chapters.add(r.cid)
        opts.data$.set(opts.data$.value)

        await sleep(0)
        opts.abortSignal?.throwIfAborted()
    }
}
