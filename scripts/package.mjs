// Packages dist/ into a .wox archive (a plain zip with plugin.json, the
// bundled entry file and images/ at the archive root).
import { existsSync } from "node:fs"
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

// The filename stays unversioned so that the Wox plugin store manifest can
// point at a stable `releases/latest/download/wox-notion-plugin.wox` URL; the
// release tag carries the version.
const outFile = join(root, "wox-notion-plugin.wox")

const zip = new AdmZip()
zip.addLocalFolder(dist)
zip.writeZip(outFile)

console.log(`Packaged ${outFile}`)
