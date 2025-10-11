import { Mdb } from "@/lib/db"
import { alphabetical } from "radash"

/**
 * Export list of chapters-read from mangadex's localstorage to our db
 */
export async function exportLocalHistory(mdb: Mdb) {
    const localHistory = readLocalHistory()
    if (!localHistory) {
        return
    }

    const toInsert: Array<{ cid: string; timestamp: string }> = []
    const lastScan = await getLastScan(mdb)
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
        await mdb.put("chapter_history", {
            id,
            cid,
            timestamp,
        })

        if (!mdb.get("chapter_history_replication_history", id)) {
            await mdb.put("chapter_history_replication_history", {
                id: id,
                isReplicated: 0,
                fromRemote: false,
                updatedAt: new Date().toISOString(),
            })
        }

        console.debug(`Exporting MD history item`, {
            id,
            cid,
            timestamp,
        })
    }
    await mdb.put(
        "meta",
        {
            timestamp: toInsert[0].timestamp,
        } satisfies LastHistoryScan,
        "last_history_scan"
    )
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

    localStorage.setItem("md", JSON.stringify(data, null, 2))
}

interface LastHistoryScan {
    timestamp: string
}

async function getLastScan(db: Mdb): Promise<LastHistoryScan | null> {
    const lastScan = await db.get("meta", "last_history_scan")
    if (!lastScan) {
        return null
    }

    return lastScan
}

export async function importRemoteHistory(db: Mdb) {
    const remoteHistory = (await db.getAll("chapter_history")).map(
        ({ timestamp, cid }) => [cid, timestamp] as [string, string]
    )

    setLocalHistory(remoteHistory)
}
