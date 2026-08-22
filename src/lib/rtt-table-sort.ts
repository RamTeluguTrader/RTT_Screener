import type { RttDashboardRow } from "./rtt-dashboard-data";

export type SortColumn = "symbol" | "price" | "rsi" | "rttScore" | "classification";
export type SortDirection = "asc" | "desc";

export type SortState = {
  column: SortColumn;
  direction: SortDirection;
};

export const DEFAULT_SORT: SortState = { column: "rttScore", direction: "desc" };

const DEFAULT_DIRECTION: Record<SortColumn, SortDirection> = {
  symbol: "asc",
  price: "desc",
  rsi: "desc",
  rttScore: "desc",
  classification: "desc",
};

const CLASSIFICATION_RANK: Record<string, number> = {
  Exceptional: 5,
  Strong: 4,
  Good: 3,
  Watch: 2,
  Weak: 1,
};

function compareValues(row: RttDashboardRow, other: RttDashboardRow, column: SortColumn): number {
  switch (column) {
    case "symbol":
      return row.symbol.localeCompare(other.symbol);
    case "price":
      return row.currentPrice - other.currentPrice;
    case "rsi":
      return (row.rsi ?? Number.NEGATIVE_INFINITY) - (other.rsi ?? Number.NEGATIVE_INFINITY);
    case "rttScore":
      return (row.rttScore ?? Number.NEGATIVE_INFINITY) - (other.rttScore ?? Number.NEGATIVE_INFINITY);
    case "classification":
      return (
        (CLASSIFICATION_RANK[row.classification ?? ""] ?? 0) - (CLASSIFICATION_RANK[other.classification ?? ""] ?? 0)
      );
  }
}

/**
 * Sorts a copy of the given (already RTT-qualified and ranked) rows for display
 * only. Never mutates the input and never touches `rttScore`, `qualified`, or
 * `rank` — it only changes presentation order. Ties always break by symbol
 * ascending so ordering is deterministic regardless of sort column or direction.
 */
export function sortDashboardRows(rows: readonly RttDashboardRow[], sort: SortState): RttDashboardRow[] {
  const multiplier = sort.direction === "asc" ? 1 : -1;
  return rows.slice().sort((left, right) => {
    const primary = compareValues(left, right, sort.column);
    if (primary !== 0) return primary * multiplier;
    return left.symbol.localeCompare(right.symbol);
  });
}

/** Clicking the active column reverses it; a new column starts at its predictable default direction. */
export function nextSortState(current: SortState, column: SortColumn): SortState {
  if (current.column === column) {
    return { column, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { column, direction: DEFAULT_DIRECTION[column] };
}
