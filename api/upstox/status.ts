/// <reference types="node" />
// Node.js runtime (not Edge) — see api/upstox/candles.ts for why.
export const config = { runtime: "nodejs" };

/**
 * Vercel Node.js Function equivalent of the local Vite dev-server proxy's
 * /api/upstox/status endpoint (see vite.config.ts). Reports only whether the
 * server-side token is configured, and its length — never its value or any
 * character of it — so a copy/paste truncation or corruption in the Vercel
 * dashboard can be diagnosed without ever exposing the token.
 */
export default {
  fetch(): Response {
    const token = process.env.UPSTOX_ACCESS_TOKEN;
    const configured = Boolean(token);
    return new Response(JSON.stringify({ configured, tokenLength: token?.length ?? 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
};
