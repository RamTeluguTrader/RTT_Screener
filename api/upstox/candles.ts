import { buildUpstoxCandleUrl, parseUpstoxCandlesBody, type RawUpstoxCandle } from "../../src/lib/upstox-proxy-shared";

export const config = { runtime: "edge" };

/**
 * Vercel Edge Function equivalent of the local Vite dev-server proxy's
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

export default async function handler(request: Request): Promise<Response> {
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
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
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
}
