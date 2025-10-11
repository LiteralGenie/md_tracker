import { AppContext } from "@/app-context"

export {}

declare global {
    const unsafeWindow: Window & {
        MD_TRACKER: {
            styles: string
            initCss: () => void
            ctx: AppContext
        }
    }
}
