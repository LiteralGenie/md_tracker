import { MonkeyUserScript } from "vite-plugin-monkey"

export default {
    name: "@todo",
    match: ["https://mangadex.org/titles/latest"],
    grant: ["unsafeWindow", "GM_addStyle"],
    version: "0.1",
    updateURL: "@todo",
    downloadURL: "@todo",
} satisfies MonkeyUserScript
