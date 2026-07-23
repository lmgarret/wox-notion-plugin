import type { Context, PublicAPI, Query, Result } from "@wox-launcher/wox-plugin"
import { mapLimit } from "./lib/async.js"
import { TtlCache } from "./lib/cache.js"
import { openPage, openUrl, type UrlOpener } from "./lib/open.js"
import { contentPreview, itemToResult, messageResult, PLUGIN_ICON, resultId } from "./lib/results.js"
import { NotionAuthError, type NotionService } from "./notion/client.js"
import type { NotionItem } from "./notion/types.js"
import { loadSettings, type PluginSettings } from "./settings.js"

export const CAPTURE_COMMAND = "add"
const SEARCH_LIMIT = 20
const RECENT_LIMIT = 10
const RECENT_CACHE_TTL_MS = 30_000
const PREVIEW_CONCURRENCY = 4
const CONTENT_CACHE_MAX = 200

const INTEGRATIONS_URL = "https://app.notion.com/developers/tokens"
const CAPTURE_DOCS_URL = "https://github.com/lmgarret/wox-notion-plugin#quick-capture"

export interface QueryDeps {
  api: PublicAPI
  getService: (token: string) => NotionService
  /** Injectable for tests; defaults to the real OS opener. */
  open?: UrlOpener
}

/**
 * Extracts the capture text when the query is a quick-capture request.
 * Returns null for non-capture queries. Wox parses registered commands into
 * `query.Command`; the raw-search fallback covers hosts that don't.
 */
export function captureText(query: Query): string | null {
  if (query.Command === CAPTURE_COMMAND) {
    return query.Search.trim()
  }
  if (!query.Command) {
    const match = query.Search.match(/^add(?:\s+(.*))?$/i)
    if (match) {
      return (match[1] ?? "").trim()
    }
  }
  return null
}

export function createQueryHandler(deps: QueryDeps) {
  const { api } = deps
  const open = deps.open ?? openUrl
  const recentCache = new TtlCache<NotionItem[]>(RECENT_CACHE_TTL_MS)
  // Rendered page content keyed by `${pageId}:${lastEditedTime}` so edits bust it.
  const contentCache = new Map<string, string>()
  let cachedToken = ""

  function cacheContent(key: string, markdown: string): void {
    contentCache.set(key, markdown)
    if (contentCache.size > CONTENT_CACHE_MAX) {
      const oldest = contentCache.keys().next().value
      if (oldest !== undefined) {
        contentCache.delete(oldest)
      }
    }
  }

  /**
   * Fetches page content for the shown page results and swaps it into their
   * preview panels via UpdateResult. Fire-and-forget: previews arrive shortly
   * after the result list, so search-as-you-type stays responsive. Per-page
   * failures are logged and skipped, leaving the metadata preview in place.
   */
  async function enrichPreviews(ctx: Context, items: NotionItem[], settings: PluginSettings): Promise<void> {
    if (typeof api.UpdateResult !== "function") {
      return
    }
    const pages = items.filter((item) => item.kind === "page")
    const service = deps.getService(settings.token)
    await mapLimit(pages, PREVIEW_CONCURRENCY, async (item) => {
      const key = `${item.id}:${item.lastEditedTime ?? ""}`
      let markdown = contentCache.get(key)
      if (markdown === undefined) {
        try {
          markdown = await service.pageContent(item.id)
        } catch (error) {
          await api.Log(ctx, "Warning", `Preview fetch failed for ${item.id}: ${error}`)
          return
        }
        cacheContent(key, markdown)
      }
      await api.UpdateResult(ctx, { Id: resultId(item), Preview: contentPreview(item, markdown) })
    })
  }

  function openUrlAction(name: string, url: string) {
    return {
      Name: name,
      Action: async (ctx: Context) => {
        try {
          await open(url)
        } catch (error) {
          await api.Notify(ctx, `Could not open ${url}: ${error instanceof Error ? error.message : error}`)
        }
      },
    }
  }

  const missingTokenResult = () =>
    messageResult(
      "Set your Notion integration token",
      "Create an internal integration, share your pages with it, then paste its secret in this plugin's settings",
      openUrlAction("Open Notion integrations page", INTEGRATIONS_URL),
    )

  const invalidTokenResult = () =>
    messageResult(
      "Notion rejected your integration token",
      "Check the token in the plugin settings and make sure the integration still exists",
      openUrlAction("Open Notion integrations page", INTEGRATIONS_URL),
    )

  async function capture(text: string, settings: PluginSettings): Promise<Result[]> {
    if (!settings.captureDatabaseId) {
      return [
        messageResult(
          "Set a capture database first",
          "Paste the URL of the target database in this plugin's settings",
          openUrlAction("How to set up quick capture", CAPTURE_DOCS_URL),
        ),
      ]
    }
    if (text === "") {
      return [messageResult(`Type your note after "${CAPTURE_COMMAND}"`, "Example: nt add Buy milk")]
    }

    const service = deps.getService(settings.token)
    const createAction = async (ctx: Context, openAfter: boolean) => {
      try {
        const page = await service.createPage(settings.captureDatabaseId, text)
        recentCache.clear()
        await api.Notify(ctx, `Created "${text}" in Notion`)
        if (openAfter) {
          await openPage(page.url, settings.openIn, open)
        }
      } catch (error) {
        await api.Log(ctx, "Error", `Quick capture failed: ${error}`)
        await api.Notify(ctx, `Could not create page: ${error instanceof Error ? error.message : error}`)
      }
    }
    return [
      {
        Title: `Create "${text}"`,
        SubTitle: "Add a page to your capture database",
        Icon: PLUGIN_ICON,
        Actions: [
          { Name: "Create", IsDefault: true, Action: (ctx) => createAction(ctx, false) },
          { Name: "Create and open", Action: (ctx) => createAction(ctx, true) },
        ],
      },
    ]
  }

  function toResults(items: NotionItem[], settings: PluginSettings): Result[] {
    return items.map((item, index) => itemToResult(item, { api, openIn: settings.openIn, open }, index))
  }

  async function recent(settings: PluginSettings): Promise<{ items: NotionItem[]; results: Result[] }> {
    let items = recentCache.get()
    if (!items) {
      items = await deps.getService(settings.token).recentPages(RECENT_LIMIT)
      recentCache.set(items)
    }
    return { items, results: toResults(items, settings) }
  }

  async function search(term: string, settings: PluginSettings): Promise<{ items: NotionItem[]; results: Result[] }> {
    const items = await deps.getService(settings.token).search(term, SEARCH_LIMIT)
    if (items.length === 0) {
      return {
        items,
        results: [messageResult(`No results for "${term}"`, "Only pages shared with your integration are searchable")],
      }
    }
    return { items, results: toResults(items, settings) }
  }

  const handler = async (ctx: Context, query: Query): Promise<Result[]> => {
    const settings = await loadSettings(ctx, api)
    if (!settings.token) {
      return [missingTokenResult()]
    }
    if (settings.token !== cachedToken) {
      recentCache.clear()
      contentCache.clear()
      cachedToken = settings.token
    }

    try {
      const text = captureText(query)
      if (text !== null) {
        return await capture(text, settings)
      }
      const { items, results } =
        query.Search.trim() === "" ? await recent(settings) : await search(query.Search.trim(), settings)
      // Enrich previews after returning the list so the UI stays responsive.
      void enrichPreviews(ctx, items, settings).catch(() => {})
      return results
    } catch (error) {
      if (error instanceof NotionAuthError) {
        return [invalidTokenResult()]
      }
      await api.Log(ctx, "Error", `Query failed: ${error}`)
      return [
        messageResult("Notion request failed", error instanceof Error ? error.message : "Unknown error — see logs"),
      ]
    }
  }

  // enrichPreviews is exposed for tests; production calls it fire-and-forget.
  return Object.assign(handler, { enrichPreviews })
}
