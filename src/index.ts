import type { Context, Plugin, PluginInitParams, PublicAPI, Query, QueryReturn } from "@wox-launcher/wox-plugin"
import { createNotionService, type NotionService } from "./notion/client.js"
import { createQueryHandler } from "./query.js"

let api: PublicAPI
let handleQuery: ReturnType<typeof createQueryHandler> | undefined

// One service per token: replaced when the user changes the token in settings.
let service: { token: string; instance: NotionService } | undefined
function getService(token: string): NotionService {
  if (service?.token !== token) {
    service = { token, instance: createNotionService(token) }
  }
  return service.instance
}

export const plugin: Plugin = {
  init: async (ctx: Context, initParams: PluginInitParams) => {
    api = initParams.API
    handleQuery = createQueryHandler({ api, getService })
    await api.Log(ctx, "Info", "Notion plugin initialized")
  },

  query: async (ctx: Context, query: Query): Promise<QueryReturn> => {
    if (!handleQuery) {
      return []
    }
    return { Results: await handleQuery(ctx, query) }
  },
}
