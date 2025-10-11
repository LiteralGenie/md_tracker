export {}

declare global {
    interface Window {
        MD_TRACKER: {
            styles: string
            initCss: () => void
        }
    }
}
