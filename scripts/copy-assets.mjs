// Copies the static plugin assets (plugin.json, images/) into dist/ so that
// dist/ is a complete plugin directory: loadable by Wox dev mode and zippable
// into a .wox package as-is.
import { cpSync, mkdirSync } from "node:fs"
import { join } from "node:path"

const root = new URL("..", import.meta.url).pathname
const dist = join(root, "dist")

mkdirSync(dist, { recursive: true })
cpSync(join(root, "plugin.json"), join(dist, "plugin.json"))
cpSync(join(root, "images"), join(dist, "images"), { recursive: true })

console.log("Copied plugin.json and images/ to dist/")
