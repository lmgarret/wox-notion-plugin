import { describe, expect, it, vi } from "vitest"
import { itemToResult } from "../src/lib/results.js"
import { makeApi, makeItem, runAction } from "./helpers.js"

describe("itemToResult", () => {
  it("uses the page's emoji icon when present", () => {
    const result = itemToResult(makeItem({ iconEmoji: "📚" }), { api: makeApi(), openIn: "app" }, 0)
    expect(result.Icon).toEqual({ ImageType: "emoji", ImageData: "📚" })
  })

  it("falls back to the plugin icon without an emoji", () => {
    const result = itemToResult(makeItem(), { api: makeApi(), openIn: "app" }, 0)
    expect(result.Icon).toEqual({ ImageType: "relative", ImageData: "images/app.svg" })
  })

  it("prefixes the subtitle with the Notion source and object kind", () => {
    const page = itemToResult(makeItem(), { api: makeApi(), openIn: "app" }, 0)
    expect(page.SubTitle).toBe("Notion - Page")
    const database = itemToResult(makeItem({ kind: "database" }), { api: makeApi(), openIn: "app" }, 0)
    expect(database.SubTitle).toBe("Notion - Database")
  })

  it("assigns a stable id so async previews can target the result", () => {
    const result = itemToResult(makeItem(), { api: makeApi(), openIn: "app" }, 0)
    expect(result.Id).toBe("notion-2af325e6-8f0c-4290-a06f-baa4e40b4c5d")
  })

  it("preserves API ranking through descending scores", () => {
    const first = itemToResult(makeItem(), { api: makeApi(), openIn: "app" }, 0)
    const second = itemToResult(makeItem(), { api: makeApi(), openIn: "app" }, 1)
    expect(first.Score).toBeGreaterThan(second.Score ?? 0)
  })

  it("makes the app action the default when openIn is app", () => {
    const result = itemToResult(makeItem(), { api: makeApi(), openIn: "app" }, 0)
    expect(result.Actions?.[0]).toMatchObject({ Name: "Open in Notion app", IsDefault: true })
    expect(result.Actions?.[1]).toMatchObject({ Name: "Open in browser", IsDefault: false })
  })

  it("makes the browser action the default when openIn is browser", () => {
    const result = itemToResult(makeItem(), { api: makeApi(), openIn: "browser" }, 0)
    expect(result.Actions?.[0]).toMatchObject({ Name: "Open in browser", IsDefault: true })
  })

  it("opens the deep link, falling back to the web URL when the app is unavailable", async () => {
    const item = makeItem()
    const open = vi.fn(async (url: string) => {
      if (url.startsWith("notion://")) {
        throw new Error("no handler")
      }
    })
    const result = itemToResult(item, { api: makeApi(), openIn: "app", open }, 0)
    await runAction(result, "Open in Notion app")
    expect(open).toHaveBeenNthCalledWith(1, item.url.replace(/^https:\/\//, "notion://"))
    expect(open).toHaveBeenNthCalledWith(2, item.url)
  })

  it("copies the page link and notifies", async () => {
    const api = makeApi()
    const item = makeItem()
    const result = itemToResult(item, { api, openIn: "app", open: vi.fn(async () => {}) }, 0)
    await runAction(result, "Copy link")
    expect(api.Copy).toHaveBeenCalledWith(expect.anything(), { type: "text", text: item.url })
    expect(api.Notify).toHaveBeenCalled()
  })

  it("notifies instead of throwing when opening fails entirely", async () => {
    const api = makeApi()
    const open = vi.fn(async () => {
      throw new Error("boom")
    })
    const result = itemToResult(makeItem(), { api, openIn: "browser", open }, 0)
    await runAction(result, "Open in browser")
    expect(api.Notify).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("boom"))
  })
})
