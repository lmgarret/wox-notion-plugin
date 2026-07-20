import type { Context, PublicAPI, Query, Result } from "@wox-launcher/wox-plugin"
import { vi } from "vitest"
import type { NotionService } from "../src/notion/client.js"
import type { NotionItem } from "../src/notion/types.js"

export const ctx = { Values: {}, Get: () => undefined, Set: () => {}, Exists: () => false } as unknown as Context

/** A PublicAPI test double covering the methods the plugin uses. */
export function makeApi(settings: Record<string, string> = {}) {
  return {
    GetSetting: vi.fn(async (_ctx: Context, key: string) => settings[key] ?? ""),
    SaveSetting: vi.fn(async () => {}),
    Log: vi.fn(async () => {}),
    Notify: vi.fn(async () => {}),
    Copy: vi.fn(async () => {}),
  } as unknown as PublicAPI & {
    GetSetting: ReturnType<typeof vi.fn>
    Log: ReturnType<typeof vi.fn>
    Notify: ReturnType<typeof vi.fn>
    Copy: ReturnType<typeof vi.fn>
  }
}

export function makeQuery(partial: Partial<Query>): Query {
  return {
    Id: "query-1",
    Type: "input",
    RawQuery: `nt ${partial.Search ?? ""}`,
    TriggerKeyword: "nt",
    Command: "",
    Search: "",
    Selection: { Type: "text", Text: "", FilePaths: [] },
    Env: {} as Query["Env"],
    IsGlobalQuery: () => false,
    ...partial,
  }
}

export function makeItem(overrides: Partial<NotionItem> = {}): NotionItem {
  return {
    id: "2af325e6-8f0c-4290-a06f-baa4e40b4c5d",
    kind: "page",
    title: "Weekly notes",
    url: "https://www.notion.so/Weekly-notes-2af325e68f0c4290a06fbaa4e40b4c5d",
    lastEditedTime: "2026-07-20T09:00:00Z",
    ...overrides,
  }
}

export function makeService(overrides: Partial<NotionService> = {}): NotionService & {
  search: ReturnType<typeof vi.fn>
  recentPages: ReturnType<typeof vi.fn>
  createPage: ReturnType<typeof vi.fn>
} {
  return {
    search: vi.fn(async () => [makeItem()]),
    recentPages: vi.fn(async () => [makeItem()]),
    createPage: vi.fn(async (_db: string, title: string) => makeItem({ title })),
    ...overrides,
    // biome-ignore lint/suspicious/noExplicitAny: test double
  } as any
}

/** Runs a result's action by name, asserting it exists and is executable. */
export async function runAction(result: Result | undefined, name: string): Promise<void> {
  if (!result) {
    throw new Error(`Expected a result to run action "${name}" on`)
  }
  const action = result.Actions?.find((a) => a.Name === name)
  if (!action || !("Action" in action) || !action.Action) {
    throw new Error(`No executable action named "${name}" on result "${result.Title}"`)
  }
  await action.Action(ctx, { ContextData: {}, ResultId: "result-1", ResultActionId: "action-1" })
}
