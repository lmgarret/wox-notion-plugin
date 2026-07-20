import type { Context, PublicAPI } from "@wox-launcher/wox-plugin"
import { extractNotionId } from "./lib/links.js"

// Keys must match the SettingDefinitions in plugin.json.
export const SETTING_TOKEN = "notionToken"
export const SETTING_CAPTURE_DATABASE = "captureDatabaseId"
export const SETTING_OPEN_IN = "openIn"

export type OpenTarget = "app" | "browser"

export interface PluginSettings {
  token: string
  /** Normalized database id, extracted from whatever the user pasted (id or URL). Empty if unset. */
  captureDatabaseId: string
  openIn: OpenTarget
}

export async function loadSettings(ctx: Context, api: PublicAPI): Promise<PluginSettings> {
  const [token, captureDatabase, openIn] = await Promise.all([
    api.GetSetting(ctx, SETTING_TOKEN),
    api.GetSetting(ctx, SETTING_CAPTURE_DATABASE),
    api.GetSetting(ctx, SETTING_OPEN_IN),
  ])
  return {
    token: (token ?? "").trim(),
    captureDatabaseId: extractNotionId(captureDatabase ?? "") ?? "",
    openIn: openIn === "browser" ? "browser" : "app",
  }
}
