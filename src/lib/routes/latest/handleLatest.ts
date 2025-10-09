import { Mdb } from "@/lib/db"

export async function handleLatest(db: Mdb) {
    return async () => {}
}

export interface LatestPage {
    items: Array<{
        id: string

        chapter: number
        volume: number | null

        title: string
        date: string
        comments: number
        uploader: {
            id: string
            name: string
        }
        group: {
            id: string
            name: string
        }
    }>
}

function parsePage(): LatestPage {}
