import { Mdb, MdbSchema } from "@/lib/db"
import { alphabetical } from "radash"

/**
 * Export list of chapters-read from mangadex's localstorage to our db
 */
export async function exportLocalHistory(
    mdb: Mdb
): Promise<Array<MdbSchema["chapter_history"]["value"]>> {
    const localHistory = readLocalHistory()
    if (!localHistory) {
        return []
    }

    const toInsert: Array<MdbSchema["chapter_history"]["value"]> = []
    const lastScan = await getLastScan(mdb)
    for (const [cid, timestamp] of localHistory) {
        if (lastScan && timestamp <= lastScan.timestamp) {
            break
        }

        const id = `${timestamp}_${cid.substring(0, 10)}`

        toInsert.push({
            id,
            cid,
            timestamp,
        })
    }
    if (toInsert.length === 0) {
        return []
    }

    for (const x of toInsert) {
        await mdb.put("chapter_history", x)

        if (!mdb.get("chapter_history_replication_history", x.id)) {
            await mdb.put("chapter_history_replication_history", {
                id: x.id,
                isReplicated: 0,
                fromRemote: false,
                updatedAt: new Date().toISOString(),
            })
        }

        console.debug(`Exporting MD history item`, x)
    }
    await mdb.put(
        "meta",
        {
            timestamp: toInsert[0].timestamp,
        } satisfies LastHistoryScan,
        "last_history_scan"
    )

    return toInsert
}

export async function importRemoteHistory(db: Mdb) {
    const remoteHistory = await db.getAll("chapter_history")

    setLocalHistory(
        remoteHistory.map(
            ({ timestamp, cid }) =>
                [cid, timestamp] as [string, string]
        )
    )

    return remoteHistory
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
