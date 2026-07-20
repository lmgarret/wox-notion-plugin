import { spawn } from "node:child_process"
import { toDeepLink } from "./links.js"

export type UrlOpener = (url: string) => Promise<void>

function openCommand(url: string): [command: string, args: string[]] {
  switch (process.platform) {
    case "darwin":
      return ["open", [url]]
    case "win32":
      // The empty string is the window title `start` would otherwise consume.
      return ["cmd", ["/c", "start", "", url]]
    default:
      return ["xdg-open", [url]]
  }
}

/** Opens a URL (or custom protocol link) with the OS default handler. */
export const openUrl: UrlOpener = (url) => {
  const [command, args] = openCommand(url)
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore", detached: true })
    child.once("error", reject)
    child.once("exit", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} exited with code ${code}`))
      }
    })
    child.unref()
  })
}

/**
 * Opens a Notion page in the requested target. When the desktop app is the
 * target but its `notion://` protocol has no handler, falls back to the browser.
 */
export async function openPage(webUrl: string, target: "app" | "browser", open: UrlOpener = openUrl): Promise<void> {
  if (target === "app") {
    try {
      await open(toDeepLink(webUrl))
      return
    } catch {
      // No handler for notion:// — fall through to the browser.
    }
  }
  await open(webUrl)
}
