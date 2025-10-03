import { MdTrackerDb } from "@/lib/db"
import { alphabetical } from "radash"

/**
 * Export list of chapters-read from mangadex's localstorage to our db
 */
export async function exportLocalHistory(db: MdTrackerDb) {
    const localHistory = readLocalHistory()
    if (!localHistory) {
        return
    }

    const toInsert: Array<{ cid: string; timestamp: string }> = []
    const lastScan = await getLastScan(db)
    for (const [cid, timestamp] of localHistory) {
        if (lastScan && timestamp <= lastScan.timestamp) {
            break
        }

        toInsert.push({
            cid,
            timestamp,
        })
    }
    if (toInsert.length === 0) {
        return
    }

    for (const { cid, timestamp } of toInsert) {
        const id = `${timestamp}_${cid.substring(0, 10)}`
        await db.rxdb.chapter_history.upsert({
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

function readLocalHistory(): Array<[string, string]> | null {
    const raw = localStorage.getItem("md")
    if (!raw) {
        return null
    }

    const readingHistory =
        JSON.parse(raw)?.readingHistory?._readingHistory
    if (!readingHistory) {
        return null
    }

    return readingHistory
}

function setLocalHistory(history: Array<[string, string]>) {
    const sorted = alphabetical(history, (x) => x[1], "desc")

    const raw = localStorage.getItem("md")
    if (!raw) {
        throw new Error("No MD key in localstorage")
    }

    const data = JSON.parse(raw)

    const oldHistory = data.readingHistory._readingHistory
    if (oldHistory.length === sorted.length) {
        return
    } else if (oldHistory.length > sorted.length) {
        throw new Error()
    } else {
        console.log("Updating MD history", oldHistory, sorted)
    }

    data.readingHistory._readingHistory = sorted

    // localStorage.setItem("md", JSON.stringify(data, null, 2))
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

export async function importRemoteHistory(db: MdTrackerDb) {
    const remoteHistory = (
        await db.rxdb.chapter_history.find().exec()
    ).map(
        ({ timestamp, cid }) => [cid, timestamp] as [string, string]
    )

    setLocalHistory(remoteHistory)
}
