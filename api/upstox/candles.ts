import type { IncomingMessage, ServerResponse } from "node:http";
import { buildUpstoxCandleUrl, parseUpstoxCandlesBody, type RawUpstoxCandle } from "../../src/lib/upstox-proxy-shared";

// Node.js runtime (not Edge): Vercel Edge Functions run in a V8-isolate
// runtime with their own fetch/TLS stack and egress IP ranges, which
// Cloudflare's bot-management layer in front of api.upstox.com was blocking
// with an HTML challenge page (before Upstox's own API logic ever saw the
// request). Node.js Serverless Functions run as real Node.js processes using
// the same undici-based fetch already proven to work from local Node — see
// vite.config.ts's dev-server proxy, which this mirrors closely.
export const config = { runtime: "nodejs" };

/**
 * Vercel Node.js Function equivalent of the local Vite dev-server proxy's
 * /api/upstox/candles endpoint (see vite.config.ts). The Upstox access token
 * is read only from the server-side UPSTOX_ACCESS_TOKEN environment variable
 * (set in the Vercel project's Environment Variables, never in frontend
 * code) and attached to the outbound request here. It is never logged and
 * never included in the response — the browser only ever sees the parsed
 * candle data.
 */
function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const accessToken = process.env.UPSTOX_ACCESS_TOKEN;
  if (!accessToken) {
    sendJson(res, 503, { error: "Upstox access token is not configured on the server (UPSTOX_ACCESS_TOKEN)." });
    return;
  }

  const requestUrl = new URL(req.url ?? "", "http://internal.local");
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
      // Diagnostic only — never includes the token. Upstox's own error body
      // (status/error code/message) contains no caller secrets, so it's safe
      // to relay to help pinpoint why the upstream request was rejected.
      const upstreamBodyText = await upstreamResponse.text().catch(() => "");
      sendJson(res, upstreamResponse.status, {
        error: `Upstox request failed (${upstreamResponse.status}).`,
        upstreamStatus: upstreamResponse.status,
        upstreamBody: upstreamBodyText.slice(0, 500),
        requestUrl: upstreamUrl,
        tokenLength: accessToken.length,
      });
      return;
    }

    const body = (await upstreamResponse.json()) as { data?: { candles?: RawUpstoxCandle[] } };
    sendJson(res, 200, { candles: parseUpstoxCandlesBody(body) });
  } catch (error) {
    sendJson(res, 502, { error: "Could not reach the Upstox API.", detail: error instanceof Error ? error.message : String(error) });
  }
}
