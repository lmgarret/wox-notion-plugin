import type { BlockObjectResponse, RichTextItemResponse } from "@notionhq/client"

const MAX_BLOCKS = 40
const MAX_CHARS = 2500

function plainText(richText: RichTextItemResponse[]): string {
  return richText.map((part) => part.plain_text).join("")
}

/** Reads the `rich_text` array of any text-bearing block, or [] for blocks without one. */
function blockRichText(block: BlockObjectResponse): RichTextItemResponse[] {
  const body = (block as Record<string, unknown>)[block.type]
  if (body && typeof body === "object" && "rich_text" in body) {
    const richText = (body as { rich_text?: unknown }).rich_text
    if (Array.isArray(richText)) {
      return richText as RichTextItemResponse[]
    }
  }
  return []
}

function renderBlock(block: BlockObjectResponse): string | null {
  const text = plainText(blockRichText(block))
  switch (block.type) {
    case "heading_1":
      return `# ${text}`
    case "heading_2":
      return `## ${text}`
    case "heading_3":
      return `### ${text}`
    case "bulleted_list_item":
    case "toggle":
      return `- ${text}`
    case "numbered_list_item":
      return `1. ${text}`
    case "to_do":
      return `- [${block.to_do.checked ? "x" : " "}] ${text}`
    case "quote":
      return `> ${text}`
    case "callout":
      return `> ${block.callout.icon?.type === "emoji" ? `${block.callout.icon.emoji} ` : ""}${text}`
    case "code":
      return `\`\`\`${block.code.language}\n${text}\n\`\`\``
    case "divider":
      return "---"
    case "child_page":
      return `📄 ${block.child_page.title}`
    case "child_database":
      return `🗃️ ${block.child_database.title}`
    default:
      // paragraph and any other text block render as plain text; skip empties.
      return text === "" ? null : text
  }
}

/** Renders a page's top-level blocks to a compact markdown preview. */
export function blocksToMarkdown(blocks: BlockObjectResponse[]): string {
  const lines: string[] = []
  let chars = 0
  for (const block of blocks.slice(0, MAX_BLOCKS)) {
    const rendered = renderBlock(block)
    if (rendered === null) {
      continue
    }
    lines.push(rendered)
    chars += rendered.length
    if (chars >= MAX_CHARS) {
      lines.push("…")
      break
    }
  }
  return lines.join("\n\n")
}
