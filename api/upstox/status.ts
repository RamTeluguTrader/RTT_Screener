export const config = { runtime: "edge" };

/**
 * Vercel Edge Function equivalent of the local Vite dev-server proxy's
 * /api/upstox/status endpoint (see vite.config.ts). Reports only whether the
 * server-side token is configured — never its value.
 */
export default function handler(): Response {
  const configured = Boolean(process.env.UPSTOX_ACCESS_TOKEN);
  return new Response(JSON.stringify({ configured }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
