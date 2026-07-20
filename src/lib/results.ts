import type { PublicAPI, Result, ResultAction } from "@wox-launcher/wox-plugin"
import type { NotionItem } from "../notion/types.js"
import type { OpenTarget } from "../settings.js"
import { openPage, openUrl, type UrlOpener } from "./open.js"
import { relativeTime } from "./time.js"

export interface ResultContext {
  api: PublicAPI
  openIn: OpenTarget
  /** Injectable for tests; defaults to the real OS opener. */
  open?: UrlOpener
}

export const PLUGIN_ICON = { ImageType: "relative", ImageData: "images/app.svg" } as const

function openActions(item: NotionItem, rc: ResultContext): ResultAction[] {
  const open = rc.open ?? openUrl
  const app: ResultAction = {
    Name: "Open in Notion app",
    IsDefault: rc.openIn === "app",
    Action: async (ctx) => {
      try {
        await openPage(item.url, "app", open)
      } catch (error) {
        await rc.api.Notify(ctx, `Could not open page: ${error instanceof Error ? error.message : error}`)
      }
    },
  }
  const browser: ResultAction = {
    Name: "Open in browser",
    IsDefault: rc.openIn === "browser",
    Action: async (ctx) => {
      try {
        await openPage(item.url, "browser", open)
      } catch (error) {
        await rc.api.Notify(ctx, `Could not open page: ${error instanceof Error ? error.message : error}`)
      }
    },
  }
  return rc.openIn === "browser" ? [browser, app] : [app, browser]
}

export function itemToResult(item: NotionItem, rc: ResultContext, index: number): Result {
  return {
    Title: item.title,
    SubTitle: item.kind === "database" ? "Database" : "Page",
    Icon: item.iconEmoji ? { ImageType: "emoji", ImageData: item.iconEmoji } : PLUGIN_ICON,
    // Wox sorts by score; preserve the API's ranking.
    Score: 1000 - index,
    Tails: item.lastEditedTime ? [{ Type: "text", Text: `edited ${relativeTime(item.lastEditedTime)}` }] : [],
    Preview: {
      PreviewType: "markdown",
      PreviewData: `**${item.title}**\n\n${item.url}`,
      PreviewProperties: {},
    },
    Actions: [
      ...openActions(item, rc),
      {
        Name: "Copy link",
        Action: async (ctx) => {
          await rc.api.Copy(ctx, { type: "text", text: item.url })
          await rc.api.Notify(ctx, "Link copied")
        },
      },
    ],
  }
}

/** A single informational result, optionally with a default action. */
export function messageResult(title: string, subTitle: string, action?: ResultAction): Result {
  return {
    Title: title,
    SubTitle: subTitle,
    Icon: PLUGIN_ICON,
    Actions: action ? [{ ...action, IsDefault: true }] : [],
  }
}
