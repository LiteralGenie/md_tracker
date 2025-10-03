import { MdTrackerDb } from "@/lib/db"

/**
 * Export list of chapters-read from mangadex's localstorage to our db
 */
export async function syncMdHistory(db: MdTrackerDb) {
    const mdData = localStorage.getItem("md")
    if (!mdData) {
        return
    }

    const readingHistory: Array<[string, string]> =
        JSON.parse(mdData)?.readingHistory?._readingHistory
    if (!readingHistory) {
        return
    }

    const toInsert: Array<{ cid: string; timestamp: string }> = []
    const lastScan = await getLastScan(db)
    for (const [cid, timestamp] of readingHistory) {
        if (lastScan && timestamp <= lastScan.timestamp) {
            break
        }

        toInsert.push({
            cid,
            timestamp,
        })
    }
    if (!toInsert) {
        return
    }

    for (const { cid, timestamp } of toInsert) {
        const id = `${timestamp}_${cid.substring(0, 10)}`
        await db.rxdb.chapter_history.insert({
            id,
            cid,
            timestamp,
        })

        console.log(`Exporting MD history item`, {
            id,
            cid,
            timestamp,
        })
    }
    await db.rxdb.meta.insert({
        key: "last_history_scan",
        value: JSON.stringify({
            timestamp: toInsert[0].timestamp,
        } satisfies LastHistoryScan),
    })
}

interface LastHistoryScan {
    timestamp: string
}

async function getLastScan(
    db: MdTrackerDb
): Promise<LastHistoryScan | null> {
    const raw = await db.rxdb.meta
        .findOne({
            selector: {
                key: "last_history_scan",
            },
        })
        .exec()
    if (!raw) {
        return null
    }

    const lastScan: LastHistoryScan = JSON.parse(raw.get("value"))
    return lastScan
}
