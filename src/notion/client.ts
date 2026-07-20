import type { DataSourceObjectResponse, PageObjectResponse } from "@notionhq/client"
import { APIErrorCode, Client, isFullPage, isFullPageOrDataSource, isNotionClientError } from "@notionhq/client"
import type { NotionItem } from "./types.js"

/** Thrown when the Notion API rejects the configured integration token. */
export class NotionAuthError extends Error {
  constructor() {
    super("Notion rejected the integration token")
    this.name = "NotionAuthError"
  }
}

export interface NotionService {
  /** Searches pages and databases shared with the integration, in relevance order. */
  search(term: string, limit?: number): Promise<NotionItem[]>
  /** Returns the most recently edited pages shared with the integration. */
  recentPages(limit?: number): Promise<NotionItem[]>
  /** Creates a page titled `title` in the given database and returns it. */
  createPage(databaseId: string, title: string): Promise<NotionItem>
}

function richTextToPlain(richText: { plain_text: string }[]): string {
  return richText.map((part) => part.plain_text).join("")
}

function pageTitle(page: PageObjectResponse): string {
  for (const property of Object.values(page.properties)) {
    if (property.type === "title") {
      return richTextToPlain(property.title)
    }
  }
  return ""
}

function toItem(object: PageObjectResponse | DataSourceObjectResponse): NotionItem {
  return {
    id: object.id,
    kind: object.object === "page" ? "page" : "database",
    title: (object.object === "page" ? pageTitle(object) : richTextToPlain(object.title)) || "Untitled",
    url: object.url,
    iconEmoji: object.icon?.type === "emoji" ? object.icon.emoji : undefined,
    lastEditedTime: object.last_edited_time,
  }
}

function translateError(error: unknown): never {
  if (isNotionClientError(error) && "code" in error && error.code === APIErrorCode.Unauthorized) {
    throw new NotionAuthError()
  }
  throw error
}

export function createNotionService(token: string): NotionService {
  const notion = new Client({ auth: token })
  // A database id maps to a stable data source id; cache the lookup.
  const dataSourceIds = new Map<string, string>()

  async function resolveDataSourceId(databaseId: string): Promise<string> {
    const cached = dataSourceIds.get(databaseId)
    if (cached) {
      return cached
    }
    const database = await notion.databases.retrieve({ database_id: databaseId })
    const dataSource = ("data_sources" in database ? database.data_sources : [])[0]
    if (!dataSource) {
      throw new Error("The configured capture database has no data source")
    }
    dataSourceIds.set(databaseId, dataSource.id)
    return dataSource.id
  }

  return {
    async search(term, limit = 20) {
      try {
        const response = await notion.search({ query: term, page_size: limit })
        return response.results.filter(isFullPageOrDataSource).map(toItem)
      } catch (error) {
        translateError(error)
      }
    },

    async recentPages(limit = 10) {
      try {
        const response = await notion.search({
          page_size: limit,
          filter: { property: "object", value: "page" },
          sort: { direction: "descending", timestamp: "last_edited_time" },
        })
        return response.results.filter(isFullPageOrDataSource).map(toItem)
      } catch (error) {
        translateError(error)
      }
    },

    async createPage(databaseId, title) {
      try {
        const dataSourceId = await resolveDataSourceId(databaseId)
        const page = await notion.pages.create({
          parent: { type: "data_source_id", data_source_id: dataSourceId },
          // "title" is the stable id of the title property, whatever its display name.
          properties: { title: { title: [{ text: { content: title } }] } },
        })
        if (isFullPage(page)) {
          return toItem(page)
        }
        return {
          id: page.id,
          kind: "page",
          title,
          url: `https://www.notion.so/${page.id.replaceAll("-", "")}`,
        }
      } catch (error) {
        translateError(error)
      }
    },
  }
}
