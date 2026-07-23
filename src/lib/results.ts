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

/** Stable result id so async previews can target the result via UpdateResult. */
export function resultId(item: NotionItem): string {
  return `notion-${item.id}`
}

function kindLabel(item: NotionItem): string {
  return item.kind === "database" ? "Notion - Database" : "Notion - Page"
}

/** Markdown preview shown before (and as a fallback to) fetched page content. */
export function metadataPreview(item: NotionItem): Result["Preview"] {
  return {
    PreviewType: "markdown",
    PreviewData: `# ${item.title}\n\n${item.url}`,
    PreviewProperties: {},
  }
}

/** Markdown preview built from a page's rendered block content. */
export function contentPreview(item: NotionItem, markdown: string): NonNullable<Result["Preview"]> {
  const body = markdown.trim() === "" ? "_This page has no previewable content._" : markdown
  return {
    PreviewType: "markdown",
    PreviewData: `# ${item.title}\n\n${body}`,
    PreviewProperties: {},
  }
}

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
    Id: resultId(item),
    Title: item.title,
    SubTitle: kindLabel(item),
    Icon: item.iconEmoji ? { ImageType: "emoji", ImageData: item.iconEmoji } : PLUGIN_ICON,
    // Wox sorts by score; preserve the API's ranking.
    Score: 1000 - index,
    Tails: item.lastEditedTime ? [{ Type: "text", Text: `edited ${relativeTime(item.lastEditedTime)}` }] : [],
    // Replaced with real page content once enrichment fetches it (see query.ts).
    Preview: metadataPreview(item),
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
