import type { IncomingMessage, ServerResponse } from "node:http";

// Node.js runtime (not Edge) — see api/upstox/candles.ts for why.
export const config = { runtime: "nodejs" };

/**
 * Vercel Node.js Function equivalent of the local Vite dev-server proxy's
 * /api/upstox/status endpoint (see vite.config.ts). Reports only whether the
 * server-side token is configured, and its length — never its value or any
 * character of it — so a copy/paste truncation or corruption in the Vercel
 * dashboard can be diagnosed without ever exposing the token.
 */
export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ configured: Boolean(token), tokenLength: token?.length ?? 0 }));
}
