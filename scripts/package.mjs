// Packages dist/ into a .wox archive (a plain zip with plugin.json, the
// bundled entry file and images/ at the archive root).
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import AdmZip from "adm-zip"

const root = new URL("..", import.meta.url).pathname
const dist = join(root, "dist")

for (const required of ["plugin.json", "index.js", "images"]) {
  if (!existsSync(join(dist, required))) {
    console.error(`dist/${required} is missing — run \`pnpm build\` first`)
    process.exit(1)
  }
}

const manifest = JSON.parse(readFileSync(join(dist, "plugin.json"), "utf8"))
const outFile = join(root, `wox-notion-plugin-${manifest.Version}.wox`)

const zip = new AdmZip()
zip.addLocalFolder(dist)
zip.writeZip(outFile)

console.log(`Packaged ${outFile}`)
