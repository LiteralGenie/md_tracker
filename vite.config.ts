import path from "path"
import { defineConfig } from "vite"
import monkey from "vite-plugin-monkey"
import headers from "./src/headers"

export default defineConfig((config) => {
    return {
        plugins: [
            monkey({
                entry: "src/index.ts",
                userscript: headers,
                styleImport: false,
                build: {
                    fileName: "md_tracker.user.js",
                    cssSideEffects: (styles: string) => {
                        function initCss(styles: string) {
                            if (
                                // @ts-ignore
                                typeof GM_addStyle == "function"
                            ) {
                                // @ts-ignore
                                GM_addStyle(styles)
                                return
                            } else {
                                const o =
                                    document.createElement("style")
                                o.textContent = styles
                                document.head.append(o)
                            }
                        }

                        unsafeWindow.MD_TRACKER =
                            unsafeWindow.MD_TRACKER ?? {
                                styles: "",
                            }

                        unsafeWindow.MD_TRACKER.styles +=
                            "\n\n" + styles

                        unsafeWindow.MD_TRACKER.initCss = () =>
                            initCss(unsafeWindow.MD_TRACKER.styles)
                    },
                },
            }),
        ],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
    }
})
