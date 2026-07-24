import { describe, expect, it, vi } from "vitest"

const { list } = vi.hoisted(() => ({ list: vi.fn() }))

vi.mock("@notionhq/client", () => ({
  APIErrorCode: { Unauthorized: "unauthorized" },
  isFullBlock: () => true,
  isFullPage: () => true,
  isFullPageOrDataSource: () => true,
  isNotionClientError: () => false,
  Client: class {
    blocks = { children: { list } }
    databases = { retrieve: vi.fn() }
    pages = { create: vi.fn() }
    search = vi.fn()
  },
}))

import { createNotionService } from "../src/notion/client.js"

function toggle(id: string, text: string) {
  return { object: "block", id, type: "toggle", has_children: true, toggle: { rich_text: [{ plain_text: text }] } }
}
function paragraph(id: string, text: string) {
  return {
    object: "block",
    id,
    type: "paragraph",
    has_children: false,
    paragraph: { rich_text: [{ plain_text: text }] },
  }
}

describe("createNotionService.pageContent", () => {
  it("expands children of collapsible blocks", async () => {
    list.mockImplementation(async ({ block_id }: { block_id: string }) => {
      if (block_id === "page1") {
        return { results: [toggle("t1", "Details"), paragraph("p1", "top level")] }
      }
      if (block_id === "t1") {
        return { results: [paragraph("c1", "inside toggle")] }
      }
      return { results: [] }
    })

    const md = await createNotionService("token").pageContent("page1")

    expect(md).toBe("- Details\n\n  inside toggle\n\ntop level")
  })

  it("does not fetch children for blocks without any", async () => {
    list.mockReset()
    list.mockImplementation(async () => ({ results: [paragraph("p1", "flat")] }))

    const md = await createNotionService("token").pageContent("page1")

    expect(md).toBe("flat")
    // Only the page itself is listed; no child fetch for the leaf paragraph.
    expect(list).toHaveBeenCalledTimes(1)
  })
})
