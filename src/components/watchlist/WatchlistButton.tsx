import { useEffect, useRef, useState } from "react";
import { Plus, Star } from "lucide-react";
import { addToWatchlist, removeFromWatchlist, useWatchlist, WATCHLIST_MAX } from "@/lib/watchlist-store";
import { cn } from "@/lib/utils";

const CONFIRM_TIMEOUT_MS = 3000;

/**
 * Add/remove control — the single watchlist interaction used everywhere
 * (stock-detail page, Scanner table rows). Removing requires a second,
 * explicit click within a short window ("Remove from Watchlist?" / a
 * reddish-tinted star) so a misclick on an already-watchlisted stock can't
 * silently drop it. Always stops click propagation, so it's safe to embed
 * inside a clickable row/card without also triggering that row's navigation.
 *
 * `variant="icon"` renders a compact star-only control (outline = not
 * watchlisted, filled = watchlisted) for dense contexts like the Scanner
 * table; `variant="compact"` adds a short "Add"/"Watching" label next to
 * the same star, for Global Search results; `variant="default"` (the
 * original) renders the full labeled button. All variants share the exact
 * same state machine below — this is not a second watchlist implementation,
 * just three renderings of one.
 */
export function WatchlistButton({
  symbol,
  className,
  variant = "default",
}: {
  symbol: string;
  className?: string;
  variant?: "default" | "icon" | "compact";
}) {
  const watchlist = useWatchlist();
  const inWatchlist = watchlist.includes(symbol);
  const isFull = !inWatchlist && watchlist.length >= WATCHLIST_MAX;
  const [confirming, setConfirming] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setConfirming(false);
  }, [inWatchlist]);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!inWatchlist) {
      if (isFull) return;
      addToWatchlist(symbol);
      return;
    }
    if (!confirming) {
      setConfirming(true);
      timeoutRef.current = window.setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
      return;
    }
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    removeFromWatchlist(symbol);
    setConfirming(false);
  }

  if (variant === "icon") {
    const label = isFull
      ? "Watchlist full — remove a stock to add another."
      : inWatchlist
        ? confirming
          ? `Click again to remove ${symbol} from watchlist`
          : `${symbol} is in your watchlist — click to remove`
        : `Add ${symbol} to watchlist`;
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isFull}
        aria-label={label}
        aria-pressed={inWatchlist}
        title={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md p-1.5 transition-colors",
          isFull
            ? "cursor-not-allowed text-muted-foreground opacity-50"
            : inWatchlist
              ? confirming
                ? "text-bear"
                : "text-primary hover:text-bear"
              : "text-muted-foreground hover:text-primary",
          className,
        )}
      >
        <Star className="h-4 w-4" fill={inWatchlist && !confirming ? "currentColor" : "none"} />
      </button>
    );
  }

  if (variant === "compact") {
    const label = isFull
      ? "Watchlist full — remove a stock to add another."
      : inWatchlist
        ? confirming
          ? `Click again to remove ${symbol} from watchlist`
          : `${symbol} is in your watchlist — click to remove`
        : `Add ${symbol} to watchlist`;
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isFull}
        aria-label={label}
        aria-pressed={inWatchlist}
        title={label}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors",
          isFull
            ? "cursor-not-allowed text-muted-foreground opacity-50"
            : inWatchlist
              ? confirming
                ? "text-bear"
                : "text-primary hover:text-bear"
              : "text-muted-foreground hover:text-primary",
          className,
        )}
      >
        <Star className="h-3.5 w-3.5" fill={inWatchlist && !confirming ? "currentColor" : "none"} />
        {inWatchlist ? (confirming ? "Remove?" : "Watching") : "Add"}
      </button>
    );
  }

  if (isFull) {
    return (
      <div className={cn("flex flex-col items-start gap-1.5", className)}>
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted-foreground opacity-60"
        >
          <Plus className="h-3.5 w-3.5" />
          Add to Watchlist
        </button>
        <p className="text-[11px] text-muted-foreground">Watchlist full — remove a stock to add another.</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={inWatchlist ? (confirming ? `Confirm removing ${symbol} from watchlist` : `Remove ${symbol} from watchlist`) : `Add ${symbol} to watchlist`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
        inWatchlist
          ? confirming
            ? "border-bear/40 bg-bear/10 text-bear"
            : "border-bull/30 bg-bull/10 text-bull hover:border-bear/40 hover:bg-bear/10 hover:text-bear"
          : "border-border bg-surface text-foreground hover:border-primary/40 hover:text-primary",
        className,
      )}
    >
      {inWatchlist ? (confirming ? "Remove from Watchlist?" : "✓ In Watchlist") : (
        <>
          <Plus className="h-3.5 w-3.5" />
          Add to Watchlist
        </>
      )}
    </button>
  );
}
