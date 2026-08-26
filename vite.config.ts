import { fileURLToPath, URL } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Connect, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { buildUpstoxCandleUrl, parseUpstoxCandlesBody, type RawUpstoxCandle } from "./src/lib/upstox-proxy-shared.ts";

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/**
 * Dev-server-only proxy for the Upstox historical-candle API. The access
 * token is read from .env.local server-side (via Vite's loadEnv, NOT the
 * VITE_ prefix mechanism, so it is never bundled or exposed to the client)
 * and attached to the outbound request here. The browser only ever talks to
 * this same-origin /api/upstox/candles endpoint and never sees the token.
 */
function upstoxProxyPlugin(accessToken: string | undefined) {
  return {
    name: "upstox-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
        if (!req.url || !req.url.startsWith("/api/upstox/")) {
          next();
          return;
        }

        const requestUrl = new URL(req.url, "http://internal.local");

        if (requestUrl.pathname === "/api/upstox/status") {
          sendJson(res, 200, { configured: Boolean(accessToken) });
          return;
        }

        if (requestUrl.pathname !== "/api/upstox/candles") {
          sendJson(res, 404, { error: "Unknown Upstox proxy endpoint." });
          return;
        }

        if (!accessToken) {
          sendJson(res, 503, { error: "Upstox access token is not configured on the server (.env.local)." });
          return;
        }

        const instrumentKey = requestUrl.searchParams.get("key");
        const from = requestUrl.searchParams.get("from");
        const to = requestUrl.searchParams.get("to");
        if (!instrumentKey || !from || !to) {
          sendJson(res, 400, { error: "Missing required query parameters: key, from, to." });
          return;
        }

        const upstreamUrl = buildUpstoxCandleUrl(instrumentKey, from, to);

        try {
          const upstreamResponse = await fetch(upstreamUrl, {
            headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
          });

          if (!upstreamResponse.ok) {
            sendJson(res, upstreamResponse.status, { error: `Upstox request failed (${upstreamResponse.status}).` });
            return;
          }

          const body = (await upstreamResponse.json()) as { data?: { candles?: RawUpstoxCandle[] } };
          sendJson(res, 200, { candles: parseUpstoxCandlesBody(body) });
        } catch {
          sendJson(res, 502, { error: "Could not reach the Upstox API." });
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss(), upstoxProxyPlugin(env.UPSTOX_ACCESS_TOKEN)],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
