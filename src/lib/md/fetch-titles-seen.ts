import { DbChangeEvent, Mdb, MdId } from "@/lib/db"
import { fetchMdApiCache } from "@/lib/md/md-utils"
import { BehaviorSubject } from "@/lib/rx/behavior-subject"
import { mergeAll } from "@/lib/rx/rx-utils"
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

export function updateMdTitlesSeen$(
    mdb: Mdb,
    titlesSeen$: BehaviorSubject<MdTitlesSeen>,
    mdToken$: BehaviorSubject<string | null>
) {
    const todo$ = new BehaviorSubject([] as MdId[])

    let onDbChange = async (ev: DbChangeEvent) => {
        for (let c of ev.changes) {
            if (c.store !== "chapter_history") {
                continue
            }

            let cid
            switch (c.op.type) {
                case "add":
                case "put":
                    cid = c.op.value.id
                    break
                case "delete":
                case "clear":
                    throw new Error()
            }

            todo$.value.push(cid)
            todo$.set(todo$.value)
        }
    }
    addEventListener("dbchange", onDbChange)

    const change$ = mergeAll(todo$, mdToken$)
    const changeSub = change$.subscribeAsync(
        async ([todo, mdToken]) => {
            if (!mdToken) {
                return
            }

            for (const cid of todo) {
                const tid = await fetchTitleForChapter(
                    mdb,
                    mdToken,
                    cid
                )
                upsertTitlesSeen(titlesSeen$, cid, tid)
                todo.shift()
            }
        }
    )

    return () => {
        removeEventListener("dbchange", onDbChange)
        changeSub.unsubscribe()
    }
}

export async function fetchMdTitlesSeen(opts: FetchTitlesSeenOpts) {
    const done = new Set<string>()

    const chapterToTitle = await opts.mdb.getAll(
        "md_chapter_to_title"
    )
    for (const { chapter: cid, title: tid } of chapterToTitle) {
        upsertTitlesSeen(opts.data$, cid, tid)
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

        const tid = await fetchTitleForChapter(
            opts.mdb,
            opts.mdToken,
            r.cid
        )
        upsertTitlesSeen(opts.data$, r.cid, tid)

        await sleep(0)
        opts.abortSignal?.throwIfAborted()
    }
}

async function fetchTitleForChapter(
    mdb: Mdb,
    mdToken: string,
    cid: MdId
): Promise<MdId | null> {
    const chapter = (await fetchMdApiCache<any>(
        mdb,
        `/chapter/${cid}`,
        mdToken,
        `/chapter/${cid}`,
        {
            maxAgeMs: 365 * 86400 * 1000,
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
        return null
    }

    const tid = chapter.data.relationships.find(
        (x) => x.type === "manga"
    )!.id
    await mdb.put("md_chapter_to_title", {
        chapter: cid,
        title: tid,
    })

    return tid
}

function upsertTitlesSeen(
    titlesSeen$: BehaviorSubject<MdTitlesSeen>,
    cid: MdId,
    tid: MdId | null
) {
    if (!tid) {
        console.warn(`Unknown chapter ${cid}`)
        return
    }

    titlesSeen$.value[tid] = titlesSeen$.value[tid] ?? {
        title: tid,
        chapters: new Set(),
    }
    titlesSeen$.value[tid].chapters.add(cid)
    titlesSeen$.set(titlesSeen$.value)
}
