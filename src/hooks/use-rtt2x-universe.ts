import { useEffect, useState } from "react";
import { loadRtt2xUniverse, type Rtt2xLiveRow } from "@/lib/rtt2x-live-data";

export type UniverseStatus = "loading" | "ready" | "error";

export type UseRtt2xUniverseResult = {
  rows: Rtt2xLiveRow[];
  failedCount: number;
  status: UniverseStatus;
  errorMessage: string | null;
  refresh: () => void;
};

/**
 * Shared data-acquisition hook: fetches + scores the whole RTT 2.X screener
 * universe once per mount. Any component using this hook benefits from the
 * same underlying candle cache (see upstox-client.ts), so mounting it in
 * multiple places on one page does not re-hit the Upstox API.
 */
export function useRtt2xUniverse(): UseRtt2xUniverseResult {
  const [rows, setRows] = useState<Rtt2xLiveRow[]>([]);
  const [failedCount, setFailedCount] = useState(0);
  const [status, setStatus] = useState<UniverseStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadRtt2xUniverse({ forceRefresh: refreshToken > 0 })
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows);
        setFailedCount(data.failedSymbols.length);
        if (data.rows.length === 0) {
          setStatus("error");
          setErrorMessage(
            data.failedSymbols[0]?.error ?? "No market data could be loaded. Check that the Upstox proxy is running and credentials are configured.",
          );
        } else {
          setStatus("ready");
          setErrorMessage(null);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to load market data.");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return { rows, failedCount, status, errorMessage, refresh: () => setRefreshToken((n) => n + 1) };
}
