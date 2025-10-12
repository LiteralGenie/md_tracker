import { AppContext } from "@/app-context"
import { DbChangeEvent } from "@/lib/db"

export {}

declare global {
    const unsafeWindow: Window & {
        MD_TRACKER: {
            styles: string
            initCss: () => void
            ctx: AppContext
        }
    }

    interface GlobalEventHandlersEventMap {
        dbchange: DbChangeEvent
    }
}
