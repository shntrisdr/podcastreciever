import { onRequest as __api_fetch_rss_js_onRequest } from "/app/functions/api/fetch-rss.js"

export const routes = [
    {
      routePath: "/api/fetch-rss",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_fetch_rss_js_onRequest],
    },
  ]