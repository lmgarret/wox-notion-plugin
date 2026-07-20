const NOTION_ID_PATTERN = /[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Formats a 32-char hex Notion id (with or without dashes) as a dashed UUID. */
export function normalizeNotionId(raw: string): string {
  const hex = raw.replaceAll("-", "").toLowerCase()
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Extracts a Notion object id from user input: a bare id (dashed or not) or a
 * Notion URL. Query parameters are ignored because they carry other ids (for
 * example the view id in `?v=`); the last id in the path is the object id.
 */
export function extractNotionId(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed === "") {
    return null
  }

  let searchSpace = trimmed
  try {
    searchSpace = new URL(trimmed).pathname
  } catch {
    // Not a URL — search the raw input.
  }

  const matches = searchSpace.match(NOTION_ID_PATTERN)
  const last = matches?.at(-1)
  return last ? normalizeNotionId(last) : null
}

/** Converts a notion.so web URL into a `notion://` deep link for the desktop app. */
export function toDeepLink(url: string): string {
  return url.replace(/^https?:\/\//, "notion://")
}
