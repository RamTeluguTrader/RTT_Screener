import type { Rtt2xLiveRow } from "./rtt2x-live-data";

export type Rtt2xSortColumn = "symbol" | "price" | "rttScore" | "momentum" | "rsi" | "rvol";
export type SortDirection = "asc" | "desc";

export type Rtt2xSortState = {
  column: Rtt2xSortColumn;
  direction: SortDirection;
};

export const DEFAULT_RTT2X_SORT: Rtt2xSortState = { column: "rttScore", direction: "desc" };

const DEFAULT_DIRECTION: Record<Rtt2xSortColumn, SortDirection> = {
  symbol: "asc",
  price: "desc",
  rttScore: "desc",
  momentum: "desc",
  rsi: "desc",
  rvol: "desc",
};

function compareValues(row: Rtt2xLiveRow, other: Rtt2xLiveRow, column: Rtt2xSortColumn): number {
  switch (column) {
    case "symbol":
      return row.symbol.localeCompare(other.symbol);
    case "price":
      return (row.currentPrice ?? Number.NEGATIVE_INFINITY) - (other.currentPrice ?? Number.NEGATIVE_INFINITY);
    case "rttScore":
      return (row.result.rttScore ?? Number.NEGATIVE_INFINITY) - (other.result.rttScore ?? Number.NEGATIVE_INFINITY);
    case "momentum":
      return (row.result.momentum20d ?? Number.NEGATIVE_INFINITY) - (other.result.momentum20d ?? Number.NEGATIVE_INFINITY);
    case "rsi":
      return (row.result.rsi ?? Number.NEGATIVE_INFINITY) - (other.result.rsi ?? Number.NEGATIVE_INFINITY);
    case "rvol":
      return (row.result.rvol ?? Number.NEGATIVE_INFINITY) - (other.result.rvol ?? Number.NEGATIVE_INFINITY);
  }
}

/** Sorts a copy for display only — never mutates the input, ties always break by symbol ascending. */
export function sortRtt2xRows(rows: readonly Rtt2xLiveRow[], sort: Rtt2xSortState): Rtt2xLiveRow[] {
  const multiplier = sort.direction === "asc" ? 1 : -1;
  return rows.slice().sort((left, right) => {
    const primary = compareValues(left, right, sort.column);
    if (primary !== 0) return primary * multiplier;
    return left.symbol.localeCompare(right.symbol);
  });
}

export function nextRtt2xSortState(current: Rtt2xSortState, column: Rtt2xSortColumn): Rtt2xSortState {
  if (current.column === column) {
    return { column, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { column, direction: DEFAULT_DIRECTION[column] };
}
