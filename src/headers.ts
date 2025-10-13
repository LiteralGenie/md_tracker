import { MonkeyUserScript } from "vite-plugin-monkey"

export default {
    name: "md_tracker",
    match: ["https://mangadex.org/*"],
    grant: ["unsafeWindow"],
    version: "1.1.0",
    downloadURL:
        "https://github.com/LiteralGenie/md_tracker/releases/download/latest/md_tracker.user.js",
} satisfies MonkeyUserScript
