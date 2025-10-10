import { Mdb } from "@/lib/db"
import "./recentlyAdded.css"

export async function handleRecentlyAdded(db: Mdb) {
    return async () => {}
}

export interface RecentlyAddedItem {
    id: string

    title: string
    description: string
    tags: {
        id: string
        name: string
    }
    comments: number
    rating: number
    status: string
}

function parsePage(): RecentlyAddedItem[] {}
