import { useSyncExternalStore } from "react";
import { stocks, type Stock } from "./market-data";

export type AlertField = "price" | "changePct" | "trendScore" | "aiConfidence" | "emaStack";
export type AlertOperator = "above" | "below" | "crosses_above" | "crosses_below" | "equals";

export type AlertChannels = { toast: boolean; feed: boolean };

export type Alert = {
  id: string;
  symbol: string;
  field: AlertField;
  operator: AlertOperator;
  value: number;
  note: string;
  channels: AlertChannels;
  source: "watchlist" | "scanner" | "manual";
  createdAt: number;
  status: "armed" | "triggered" | "paused";
  triggeredAt: number | null;
  triggeredValue: number | null;
};

export type AlertDraft = Omit<
  Alert,
  "id" | "createdAt" | "status" | "triggeredAt" | "triggeredValue"
>;

export const FIELD_META: Record<
  AlertField,
  { label: string; unit: "inr" | "pct" | "score" | "state"; help: string }
> = {
  price: { label: "Live price", unit: "inr", help: "Last traded price" },
  changePct: { label: "Day change %", unit: "pct", help: "Change since previous close" },
  trendScore: { label: "Trend score", unit: "score", help: "EMA stack quality, 0–100" },
  aiConfidence: { label: "AI confidence", unit: "score", help: "Model conviction, 0–100" },
  emaStack: { label: "EMAs above price", unit: "state", help: "Count of EMAs price trades above" },
};

export const OPERATOR_LABEL: Record<AlertOperator, string> = {
  above: "is above",
  below: "is below",
  crosses_above: "crosses above",
  crosses_below: "crosses below",
  equals: "equals",
};

const STORAGE_KEY = "rtt.alerts.v1";

const SEED: AlertDraft[] = [
  {
    symbol: "DIXON",
    field: "price",
    operator: "crosses_above",
    value: 14250,
    note: "Breakout continuation entry",
    channels: { toast: true, feed: true },
    source: "scanner",
  },
  {
    symbol: "BEL",
    field: "trendScore",
    operator: "above",
    value: 90,
    note: "Add on strength",
    channels: { toast: true, feed: true },
    source: "watchlist",
  },
  {
    symbol: "HDFCBANK",
    field: "aiConfidence",
    operator: "above",
    value: 80,
    note: "Wait for model conviction",
    channels: { toast: false, feed: true },
    source: "scanner",
  },
  {
    symbol: "ASIANPAINT",
    field: "price",
    operator: "below",
    value: 2250,
    note: "Breakdown — avoid longs",
    channels: { toast: true, feed: true },
    source: "watchlist",
  },
];

let alerts: Alert[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

function makeAlert(draft: AlertDraft): Alert {
  return {
    ...draft,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    status: "armed",
    triggeredAt: null,
    triggeredValue: null,
  };
}

export function hydrateAlerts() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      alerts = JSON.parse(raw) as Alert[];
      emit();
      return;
    } catch {
      /* fall through to seed */
    }
  }
  alerts = SEED.map(makeAlert);
  persist();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: Alert[] = [];

export function useAlerts() {
  return useSyncExternalStore(
    subscribe,
    () => alerts,
    () => EMPTY,
  );
}

export function createAlert(draft: AlertDraft) {
  const alert = makeAlert(draft);
  alerts = [alert, ...alerts];
  persist();
  emit();
  return alert;
}

export function removeAlert(id: string) {
  alerts = alerts.filter((a) => a.id !== id);
  persist();
  emit();
}

export function toggleAlert(id: string) {
  alerts = alerts.map((a) =>
    a.id === id
      ? {
          ...a,
          status: a.status === "paused" ? "armed" : "paused",
          triggeredAt: null,
          triggeredValue: null,
        }
      : a,
  );
  persist();
  emit();
}

export function rearmAlert(id: string) {
  alerts = alerts.map((a) =>
    a.id === id ? { ...a, status: "armed", triggeredAt: null, triggeredValue: null } : a,
  );
  persist();
  emit();
}

export function readFieldValue(stock: Stock, field: AlertField): number {
  switch (field) {
    case "price":
      return stock.price;
    case "changePct":
      return stock.changePct;
    case "trendScore":
      return stock.trendScore;
    case "aiConfidence":
      return stock.aiConfidence;
    case "emaStack":
      return Object.values(stock.ema).filter((s) => s === "above").length;
  }
}

function matches(current: number, operator: AlertOperator, target: number) {
  switch (operator) {
    case "above":
    case "crosses_above":
      return current > target;
    case "below":
    case "crosses_below":
      return current < target;
    case "equals":
      return Math.abs(current - target) < 0.005;
  }
}

export function formatValue(field: AlertField, value: number) {
  const unit = FIELD_META[field].unit;
  if (unit === "inr")
    return "₹" + value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (unit === "pct") return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  if (unit === "state") return `${value} of 5`;
  return String(value);
}

export function describeAlert(alert: Alert) {
  return `${FIELD_META[alert.field].label} ${OPERATOR_LABEL[alert.operator]} ${formatValue(
    alert.field,
    alert.value,
  )}`;
}

/** Evaluates armed alerts against the current market snapshot. Returns newly fired alerts. */
export function evaluateAlerts(): Alert[] {
  const fired: Alert[] = [];
  const next = alerts.map((alert) => {
    if (alert.status !== "armed") return alert;
    const stock = stocks.find((s) => s.symbol === alert.symbol);
    if (!stock) return alert;
    const current = readFieldValue(stock, alert.field);
    if (!matches(current, alert.operator, alert.value)) return alert;
    const triggered: Alert = {
      ...alert,
      status: "triggered",
      triggeredAt: Date.now(),
      triggeredValue: current,
    };
    fired.push(triggered);
    return triggered;
  });
  if (fired.length) {
    alerts = next;
    persist();
    emit();
  }
  return fired;
}
