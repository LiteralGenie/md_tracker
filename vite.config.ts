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
                build: {
                    fileName: "md_tracker.user.js",
                    cssSideEffects: () => {
                        return (styles: string) => {
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
                                        document.createElement(
                                            "style"
                                        )
                                    o.textContent = styles
                                    document.head.append(o)
                                }
                            }

                            // @ts-ignore
                            window.INIT_STYLES = () => initCss(styles)
                        }
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
