import { useNavigate } from "@tanstack/react-router";

export function WatchlistEmptyState() {
  const navigate = useNavigate();
  return (
    <div className="panel flex flex-col items-center gap-3 p-10 text-center">
      <h2 className="text-sm font-semibold">My Watchlist is empty</h2>
      <p className="max-w-sm text-xs text-muted-foreground">Add stocks you want to monitor from Stock Detail.</p>
      <button
        type="button"
        onClick={() => navigate({ to: "/scanner", search: { view: "top10" } })}
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
      >
        Explore Top 10
      </button>
    </div>
  );
}
