import type { BlockObjectResponse, RichTextItemResponse } from "@notionhq/client"

const MAX_LINES = 60
const MAX_CHARS = 2500
const INDENT = "  "

/** A block together with its (already-fetched) child blocks. */
export interface BlockNode {
  block: BlockObjectResponse
  children: BlockNode[]
}

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

/** Renders one block to a markdown line, or null when it carries no previewable text. */
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

/** Indents every line of a rendered block by `depth` levels. */
function indent(rendered: string, depth: number): string {
  if (depth === 0) {
    return rendered
  }
  const pad = INDENT.repeat(depth)
  return rendered
    .split("\n")
    .map((line) => pad + line)
    .join("\n")
}

function collect(nodes: BlockNode[], depth: number, lines: string[]): boolean {
  for (const node of nodes) {
    const rendered = renderBlock(node.block)
    if (rendered !== null) {
      lines.push(indent(rendered, depth))
      if (lines.length >= MAX_LINES || lines.join("\n\n").length >= MAX_CHARS) {
        lines.push(indent("…", depth))
        return false
      }
    }
    // Children of collapsible/nested blocks render indented beneath their parent.
    if (node.children.length > 0 && !collect(node.children, depth + 1, lines)) {
      return false
    }
  }
  return true
}

/** Renders a page's block tree (with expanded children) to a compact markdown preview. */
export function nodesToMarkdown(nodes: BlockNode[]): string {
  const lines: string[] = []
  collect(nodes, 0, lines)
  return lines.join("\n\n")
}

/** Convenience for a flat list of top-level blocks with no children. */
export function blocksToMarkdown(blocks: BlockObjectResponse[]): string {
  return nodesToMarkdown(blocks.map((block) => ({ block, children: [] })))
}
