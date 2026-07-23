import type { BlockObjectResponse } from "@notionhq/client"
import { describe, expect, it } from "vitest"
import { blocksToMarkdown } from "../src/notion/blocks.js"

/** Builds a minimal block object; only the fields the renderer reads matter. */
function block(type: string, body: unknown): BlockObjectResponse {
  return { type, [type]: body } as unknown as BlockObjectResponse
}

function richText(text: string) {
  return { rich_text: [{ plain_text: text }] }
}

describe("blocksToMarkdown", () => {
  it("renders headings at the right level", () => {
    const md = blocksToMarkdown([
      block("heading_1", richText("Title")),
      block("heading_2", richText("Section")),
      block("heading_3", richText("Sub")),
    ])
    expect(md).toBe("# Title\n\n## Section\n\n### Sub")
  })

  it("renders paragraphs, lists, to-dos and quotes", () => {
    const md = blocksToMarkdown([
      block("paragraph", richText("Hello")),
      block("bulleted_list_item", richText("one")),
      block("numbered_list_item", richText("first")),
      block("to_do", { ...richText("done"), checked: true }),
      block("to_do", { ...richText("todo"), checked: false }),
      block("quote", richText("wise words")),
    ])
    expect(md).toBe("Hello\n\n- one\n\n1. first\n\n- [x] done\n\n- [ ] todo\n\n> wise words")
  })

  it("renders code blocks with the language fence", () => {
    const md = blocksToMarkdown([block("code", { rich_text: [{ plain_text: "print(1)" }], language: "python" })])
    expect(md).toBe("```python\nprint(1)\n```")
  })

  it("renders callouts with their emoji icon", () => {
    const md = blocksToMarkdown([
      block("callout", { rich_text: [{ plain_text: "note" }], icon: { type: "emoji", emoji: "💡" } }),
    ])
    expect(md).toBe("> 💡 note")
  })

  it("renders dividers and child pages", () => {
    const md = blocksToMarkdown([block("divider", {}), block("child_page", { title: "Sub page" })])
    expect(md).toBe("---\n\n📄 Sub page")
  })

  it("skips empty paragraphs and unsupported blocks", () => {
    const md = blocksToMarkdown([
      block("paragraph", richText("")),
      block("unsupported", {}),
      block("paragraph", richText("kept")),
    ])
    expect(md).toBe("kept")
  })

  it("returns an empty string with no blocks", () => {
    expect(blocksToMarkdown([])).toBe("")
  })
})
