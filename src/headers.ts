import { MonkeyUserScript } from "vite-plugin-monkey"

export default {
    name: "md_tracker",
    match: ["https://mangadex.org/*"],
    grant: ["unsafeWindow"],
    version: "0.1",
    // updateURL: "@todo",
    // downloadURL: "@todo",
} satisfies MonkeyUserScript
