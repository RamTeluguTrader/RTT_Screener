/// <reference types="node" />
import { buildUpstoxCandleUrl, parseUpstoxCandlesBody, type RawUpstoxCandle } from "../../src/lib/upstox-proxy-shared.js";

// Node.js runtime (not Edge): Vercel Edge Runtime forcibly overrides the
// outbound fetch User-Agent to a Vercel-identifying string that application
// code cannot change (confirmed Vercel/Next.js platform behavior). Cloudflare's
// bot-management layer in front of api.upstox.com was blocking that string with
// an HTML challenge page — before Upstox's own API logic ever saw the request
// (confirmed via the temporary diagnostics: matching token/length, but a
// Cloudflare "Attention Required!" body instead of Upstox's own JSON error).
// Node.js runtime uses a real fetch (undici) with fully controllable headers,
// same as the local Vite proxy that's already proven to work, and lets us set
// a descriptive, non-generic User-Agent instead.
export const config = { runtime: "nodejs" };

const UPSTOX_USER_AGENT = "RTT-Screener/1.0";

/**
 * Vercel Node.js Function equivalent of the local Vite dev-server proxy's
 * /api/upstox/candles endpoint (see vite.config.ts). The Upstox access token
 * is read only from the server-side UPSTOX_ACCESS_TOKEN environment variable
 * (set in the Vercel project's Environment Variables, never in frontend
 * code) and attached to the outbound request here. It is never logged and
 * never included in the response — the browser only ever sees the parsed
 * candle data.
 */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const accessToken = process.env.UPSTOX_ACCESS_TOKEN;
    if (!accessToken) {
      return json(503, { error: "Upstox access token is not configured on the server (UPSTOX_ACCESS_TOKEN)." });
    }

    const requestUrl = new URL(request.url);
    const instrumentKey = requestUrl.searchParams.get("key");
    const from = requestUrl.searchParams.get("from");
    const to = requestUrl.searchParams.get("to");
    if (!instrumentKey || !from || !to) {
      return json(400, { error: "Missing required query parameters: key, from, to." });
    }

    const upstreamUrl = buildUpstoxCandleUrl(instrumentKey, from, to);

    try {
      const upstreamResponse = await fetch(upstreamUrl, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": UPSTOX_USER_AGENT,
        },
      });

      if (!upstreamResponse.ok) {
        // Diagnostic only — never includes the token. Upstox's own error body
        // (status/error code/message) contains no caller secrets, so it's safe
        // to relay to help pinpoint why the upstream request was rejected.
        const upstreamBodyText = await upstreamResponse.text().catch(() => "");
        return json(upstreamResponse.status, {
          error: `Upstox request failed (${upstreamResponse.status}).`,
          upstreamStatus: upstreamResponse.status,
          upstreamBody: upstreamBodyText.slice(0, 500),
          requestUrl: upstreamUrl,
          tokenLength: accessToken.length,
        });
      }

      const body = (await upstreamResponse.json()) as { data?: { candles?: RawUpstoxCandle[] } };
      return json(200, { candles: parseUpstoxCandlesBody(body) });
    } catch (error) {
      return json(502, { error: "Could not reach the Upstox API.", detail: error instanceof Error ? error.message : String(error) });
    }
  },
};
