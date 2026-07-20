/** The kinds of Notion objects surfaced as launcher results. */
export type NotionItemKind = "page" | "database"

/** The subset of a Notion page/data source the plugin needs to render a result. */
export interface NotionItem {
  id: string
  kind: NotionItemKind
  title: string
  url: string
  iconEmoji?: string
  lastEditedTime?: string
}
