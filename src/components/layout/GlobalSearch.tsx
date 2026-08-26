import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";

import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import { moveHighlight, resolveSelection, searchUniverse } from "@/lib/rtt2x-search";
import type { UniverseStock } from "@/lib/rtt2x-universe";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 120;

/**
 * "Search -> Research" only. Selecting a result navigates straight to the
 * existing stock-detail page (which fetches live data itself) — this
 * component never fetches anything itself. Each result also carries a
 * compact watchlist action (the same WatchlistButton/store used everywhere
 * else) so a stock can be added without leaving the dropdown; that action is
 * a sibling of the navigate button, not nested inside it, and stops its own
 * click propagation, so it never triggers navigation.
 */
export function GlobalSearch({
  className,
  inputClassName,
  onNavigate,
  autoFocus,
}: {
  className?: string;
  inputClassName?: string;
  onNavigate?: () => void;
  autoFocus?: boolean;
}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo(() => searchUniverse(debouncedQuery), [debouncedQuery]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function selectResult(stock: UniverseStock) {
    navigate({ to: "/stock/$symbol", params: { symbol: stock.symbol } });
    setQuery("");
    setDebouncedQuery("");
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
    onNavigate?.();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!isOpen) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => moveHighlight(current, "down", results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => moveHighlight(current, "up", results.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = resolveSelection(results, highlightedIndex);
      if (target) selectResult(target);
    }
  }

  const trimmedQuery = query.trim();

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          autoFocus={autoFocus}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="global-search-listbox"
          aria-autocomplete="list"
          aria-label="Search stocks by symbol, company, or sector"
          placeholder="Search symbol, sector, setup"
          autoComplete="off"
          className={cn("w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground", inputClassName)}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setDebouncedQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="num shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">/</kbd>
        )}
      </div>

      {isOpen && (
        <div
          id="global-search-listbox"
          role="listbox"
          aria-label="Search results"
          className="scroll-slim absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-80 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl"
        >
          {trimmedQuery === "" ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">Search by NSE symbol or company name.</p>
          ) : results.length === 0 ? (
            <div className="px-3 py-4">
              <p className="text-xs font-medium text-foreground">No matching stocks found</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Search by NSE symbol or company name.</p>
            </div>
          ) : (
            <ul>
              {results.map((stock, index) => (
                <li key={stock.symbol} role="option" aria-selected={index === highlightedIndex}>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 transition-colors",
                      index === highlightedIndex ? "bg-accent" : "hover:bg-accent/60",
                    )}
                  >
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectResult(stock)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                    >
                      <span className="num text-xs font-semibold">{stock.symbol}</span>
                      <span className="truncate text-[11px] text-muted-foreground">{stock.companyName}</span>
                      <span className="text-[10px] text-muted-foreground">{stock.sector}</span>
                    </button>
                    <div onMouseDown={(event) => event.preventDefault()}>
                      <WatchlistButton symbol={stock.symbol} variant="compact" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
