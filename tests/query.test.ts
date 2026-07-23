import { describe, expect, it, vi } from "vitest"
import { NotionAuthError } from "../src/notion/client.js"
import { captureText, createQueryHandler } from "../src/query.js"
import { ctx, makeApi, makeItem, makeQuery, makeService, runAction } from "./helpers.js"

const TOKEN = "ntn_test_token"
const DB_URL = "https://www.notion.so/myws/Inbox-2af325e68f0c4290a06fbaa4e40b4c5d?v=ffffffffffffffffffffffffffffffff"
const DB_ID = "2af325e6-8f0c-4290-a06f-baa4e40b4c5d"

function setup(settings: Record<string, string> = {}, service = makeService()) {
  const api = makeApi({ notionToken: TOKEN, ...settings })
  const open = vi.fn(async () => {})
  const handle = createQueryHandler({ api, getService: () => service, open })
  return { api, service, open, handle }
}

describe("captureText", () => {
  it("uses the parsed command when Wox recognized it", () => {
    expect(captureText(makeQuery({ Command: "add", Search: "Buy milk" }))).toBe("Buy milk")
  })

  it("falls back to parsing the raw search", () => {
    expect(captureText(makeQuery({ Search: "add Buy milk" }))).toBe("Buy milk")
    expect(captureText(makeQuery({ Search: "add" }))).toBe("")
  })

  it("does not treat regular searches as captures", () => {
    expect(captureText(makeQuery({ Search: "additional notes" }))).toBeNull()
    expect(captureText(makeQuery({ Search: "roadmap" }))).toBeNull()
  })
})

describe("query handler", () => {
  it("asks for a token when none is configured", async () => {
    const { handle, service } = setup({ notionToken: "" })
    const results = await handle(ctx, makeQuery({ Search: "anything" }))
    expect(results).toHaveLength(1)
    expect(results[0]?.Title).toBe("Set your Notion integration token")
    expect(service.search).not.toHaveBeenCalled()
  })

  it("shows recent pages for an empty query", async () => {
    const { handle, service } = setup()
    const results = await handle(ctx, makeQuery({ Search: "  " }))
    expect(service.recentPages).toHaveBeenCalled()
    expect(results[0]?.Title).toBe("Weekly notes")
  })

  it("caches recent pages between empty queries", async () => {
    const { handle, service } = setup()
    await handle(ctx, makeQuery({ Search: "" }))
    await handle(ctx, makeQuery({ Search: "" }))
    expect(service.recentPages).toHaveBeenCalledTimes(1)
  })

  it("searches with the trimmed term", async () => {
    const { handle, service } = setup()
    await handle(ctx, makeQuery({ Search: " roadmap " }))
    expect(service.search).toHaveBeenCalledWith("roadmap", expect.any(Number))
  })

  it("returns a friendly result when a search has no matches", async () => {
    const service = makeService({ search: vi.fn(async () => []) })
    const { handle } = setup({}, service)
    const results = await handle(ctx, makeQuery({ Search: "nothing" }))
    expect(results[0]?.Title).toContain("No results")
  })

  it("asks to configure a capture database before capturing", async () => {
    const { handle } = setup()
    const results = await handle(ctx, makeQuery({ Command: "add", Search: "Buy milk" }))
    expect(results[0]?.Title).toBe("Set a capture database first")
  })

  it("asks for text when the capture is empty", async () => {
    const { handle } = setup({ captureDatabaseId: DB_URL })
    const results = await handle(ctx, makeQuery({ Command: "add", Search: "" }))
    expect(results[0]?.Title).toContain("Type your note")
  })

  it("creates a page in the configured database on capture", async () => {
    const { handle, service, api } = setup({ captureDatabaseId: DB_URL })
    const results = await handle(ctx, makeQuery({ Command: "add", Search: "Buy milk" }))
    expect(results[0]?.Title).toBe('Create "Buy milk"')

    await runAction(results[0], "Create")
    expect(service.createPage).toHaveBeenCalledWith(DB_ID, "Buy milk")
    expect(api.Notify).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("Buy milk"))
  })

  it("captures via the raw-search fallback when the host did not parse the command", async () => {
    const { handle } = setup({ captureDatabaseId: DB_URL })
    const results = await handle(ctx, makeQuery({ Search: "add Buy milk" }))
    expect(results[0]?.Title).toBe('Create "Buy milk"')
  })

  it("notifies instead of throwing when page creation fails", async () => {
    const service = makeService({
      createPage: vi.fn(async () => {
        throw new Error("boom")
      }),
    })
    const { handle, api } = setup({ captureDatabaseId: DB_URL }, service)
    const results = await handle(ctx, makeQuery({ Command: "add", Search: "Buy milk" }))
    await runAction(results[0], "Create")
    expect(api.Notify).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("boom"))
    expect(api.Log).toHaveBeenCalled()
  })

  it("reports an invalid token distinctly", async () => {
    const service = makeService({
      search: vi.fn(async () => {
        throw new NotionAuthError()
      }),
    })
    const { handle } = setup({}, service)
    const results = await handle(ctx, makeQuery({ Search: "roadmap" }))
    expect(results[0]?.Title).toBe("Notion rejected your integration token")
  })

  it("logs and reports unexpected API failures", async () => {
    const service = makeService({
      search: vi.fn(async () => {
        throw new Error("rate limited")
      }),
    })
    const { handle, api } = setup({}, service)
    const results = await handle(ctx, makeQuery({ Search: "roadmap" }))
    expect(results[0]?.Title).toBe("Notion request failed")
    expect(results[0]?.SubTitle).toContain("rate limited")
    expect(api.Log).toHaveBeenCalledWith(expect.anything(), "Error", expect.stringContaining("rate limited"))
  })

  it("maps result items with the configured open target", async () => {
    const service = makeService({ recentPages: vi.fn(async () => [makeItem()]) })
    const { handle } = setup({ openIn: "browser" }, service)
    const results = await handle(ctx, makeQuery({ Search: "" }))
    expect(results[0]?.Actions?.[0]).toMatchObject({ Name: "Open in browser", IsDefault: true })
  })
})

describe("preview enrichment", () => {
  it("fetches page content and updates the result preview", async () => {
    const item = makeItem()
    const service = makeService({ pageContent: vi.fn(async () => "Fetched body") })
    const { handle, api } = setup({}, service)
    await handle.enrichPreviews(ctx, [item], { token: TOKEN, captureDatabaseId: "", openIn: "app" })

    expect(service.pageContent).toHaveBeenCalledWith(item.id)
    expect(api.UpdateResult).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        Id: "notion-2af325e6-8f0c-4290-a06f-baa4e40b4c5d",
        Preview: expect.objectContaining({ PreviewData: expect.stringContaining("Fetched body") }),
      }),
    )
  })

  it("skips databases, which have no block content", async () => {
    const service = makeService()
    const { handle, api } = setup({}, service)
    await handle.enrichPreviews(ctx, [makeItem({ kind: "database" })], {
      token: TOKEN,
      captureDatabaseId: "",
      openIn: "app",
    })
    expect(service.pageContent).not.toHaveBeenCalled()
    expect(api.UpdateResult).not.toHaveBeenCalled()
  })

  it("caches content across calls, keyed by last-edited time", async () => {
    const item = makeItem()
    const service = makeService({ pageContent: vi.fn(async () => "body") })
    const { handle } = setup({}, service)
    const settings = { token: TOKEN, captureDatabaseId: "", openIn: "app" as const }
    await handle.enrichPreviews(ctx, [item], settings)
    await handle.enrichPreviews(ctx, [item], settings)
    expect(service.pageContent).toHaveBeenCalledTimes(1)

    await handle.enrichPreviews(ctx, [makeItem({ lastEditedTime: "2026-07-21T00:00:00Z" })], settings)
    expect(service.pageContent).toHaveBeenCalledTimes(2)
  })

  it("logs and skips a page whose content fetch fails, leaving its preview untouched", async () => {
    const service = makeService({
      pageContent: vi.fn(async () => {
        throw new Error("boom")
      }),
    })
    const { handle, api } = setup({}, service)
    await handle.enrichPreviews(ctx, [makeItem()], { token: TOKEN, captureDatabaseId: "", openIn: "app" })
    expect(api.Log).toHaveBeenCalledWith(expect.anything(), "Warning", expect.stringContaining("boom"))
    expect(api.UpdateResult).not.toHaveBeenCalled()
  })
})
