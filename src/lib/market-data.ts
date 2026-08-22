export type EmaState = "above" | "below" | "cross";

export type Stock = {
  symbol: string;
  company: string;
  sector: string;
  price: number;
  change: number;
  changePct: number;
  ema: { e10: EmaState; e20: EmaState; e50: EmaState; e100: EmaState; e200: EmaState };
  trendScore: number;
  aiConfidence: number;
  spark: number[];
};

const s = (...n: number[]) => n;

export const stocks: Stock[] = [
  {
    symbol: "TATAMOTORS",
    company: "Tata Motors Ltd.",
    sector: "Auto",
    price: 1042.35,
    change: 28.9,
    changePct: 2.85,
    ema: { e10: "above", e20: "above", e50: "above", e100: "above", e200: "above" },
    trendScore: 94,
    aiConfidence: 91,
    spark: s(12, 14, 13, 16, 18, 17, 21, 24, 23, 27, 29, 33),
  },
  {
    symbol: "PERSISTENT",
    company: "Persistent Systems Ltd.",
    sector: "IT",
    price: 5688.1,
    change: 122.45,
    changePct: 2.2,
    ema: { e10: "above", e20: "above", e50: "above", e100: "above", e200: "above" },
    trendScore: 91,
    aiConfidence: 88,
    spark: s(30, 31, 29, 33, 35, 34, 38, 40, 39, 43, 45, 48),
  },
  {
    symbol: "HDFCBANK",
    company: "HDFC Bank Ltd.",
    sector: "Banking",
    price: 1721.6,
    change: 9.15,
    changePct: 0.53,
    ema: { e10: "above", e20: "above", e50: "above", e100: "cross", e200: "above" },
    trendScore: 78,
    aiConfidence: 74,
    spark: s(20, 21, 20, 22, 21, 23, 22, 24, 25, 24, 26, 27),
  },
  {
    symbol: "DIXON",
    company: "Dixon Technologies (India)",
    sector: "Electronics",
    price: 14320.0,
    change: 411.2,
    changePct: 2.96,
    ema: { e10: "above", e20: "above", e50: "above", e100: "above", e200: "above" },
    trendScore: 96,
    aiConfidence: 93,
    spark: s(40, 42, 41, 46, 48, 51, 50, 55, 58, 61, 64, 69),
  },
  {
    symbol: "SUNPHARMA",
    company: "Sun Pharmaceutical Ind.",
    sector: "Pharma",
    price: 1789.25,
    change: -12.4,
    changePct: -0.69,
    ema: { e10: "below", e20: "above", e50: "above", e100: "above", e200: "above" },
    trendScore: 66,
    aiConfidence: 61,
    spark: s(26, 27, 28, 27, 29, 28, 30, 29, 28, 30, 29, 28),
  },
  {
    symbol: "JSWSTEEL",
    company: "JSW Steel Ltd.",
    sector: "Metals",
    price: 968.4,
    change: 18.75,
    changePct: 1.97,
    ema: { e10: "above", e20: "above", e50: "above", e100: "above", e200: "cross" },
    trendScore: 82,
    aiConfidence: 79,
    spark: s(18, 17, 19, 20, 19, 22, 23, 22, 25, 26, 28, 30),
  },
  {
    symbol: "ZOMATO",
    company: "Eternal Ltd. (Zomato)",
    sector: "Consumer Tech",
    price: 268.9,
    change: 7.35,
    changePct: 2.81,
    ema: { e10: "above", e20: "above", e50: "above", e100: "above", e200: "above" },
    trendScore: 89,
    aiConfidence: 85,
    spark: s(10, 11, 13, 12, 15, 16, 18, 17, 20, 22, 24, 26),
  },
  {
    symbol: "ASIANPAINT",
    company: "Asian Paints Ltd.",
    sector: "FMCG",
    price: 2284.05,
    change: -34.6,
    changePct: -1.49,
    ema: { e10: "below", e20: "below", e50: "below", e100: "below", e200: "above" },
    trendScore: 31,
    aiConfidence: 44,
    spark: s(34, 33, 32, 33, 31, 30, 31, 29, 28, 27, 26, 25),
  },
  {
    symbol: "BEL",
    company: "Bharat Electronics Ltd.",
    sector: "Defence",
    price: 412.7,
    change: 11.05,
    changePct: 2.75,
    ema: { e10: "above", e20: "above", e50: "above", e100: "above", e200: "above" },
    trendScore: 92,
    aiConfidence: 87,
    spark: s(14, 15, 16, 15, 18, 19, 21, 20, 23, 25, 26, 29),
  },
  {
    symbol: "INDIGO",
    company: "InterGlobe Aviation Ltd.",
    sector: "Aviation",
    price: 4611.85,
    change: 46.2,
    changePct: 1.01,
    ema: { e10: "above", e20: "above", e50: "cross", e100: "above", e200: "above" },
    trendScore: 74,
    aiConfidence: 70,
    spark: s(24, 25, 24, 26, 27, 26, 28, 29, 28, 30, 31, 32),
  },
  {
    symbol: "POLYCAB",
    company: "Polycab India Ltd.",
    sector: "Capital Goods",
    price: 6740.5,
    change: 138.9,
    changePct: 2.1,
    ema: { e10: "above", e20: "above", e50: "above", e100: "above", e200: "above" },
    trendScore: 88,
    aiConfidence: 84,
    spark: s(28, 30, 29, 32, 34, 33, 36, 38, 40, 39, 43, 46),
  },
  {
    symbol: "IRCTC",
    company: "Indian Railway Catering & Tourism",
    sector: "Travel",
    price: 786.15,
    change: -8.4,
    changePct: -1.06,
    ema: { e10: "below", e20: "below", e50: "above", e100: "above", e200: "above" },
    trendScore: 48,
    aiConfidence: 52,
    spark: s(22, 23, 22, 21, 22, 20, 21, 19, 20, 19, 18, 18),
  },
];

export const summary = {
  marketStatus: { label: "Live", session: "NSE · 09:15 – 15:30 IST", nifty: 24812.4, niftyPct: 0.62 },
  scanned: 1847,
  emaQualified: 214,
  breakouts: 37,
  aiSignals: 19,
};

export const topGainers = [
  { symbol: "DIXON", pct: 2.96, price: 14320.0 },
  { symbol: "TATAMOTORS", pct: 2.85, price: 1042.35 },
  { symbol: "ZOMATO", pct: 2.81, price: 268.9 },
  { symbol: "BEL", pct: 2.75, price: 412.7 },
  { symbol: "PERSISTENT", pct: 2.2, price: 5688.1 },
];

export const topLosers = [
  { symbol: "ASIANPAINT", pct: -1.49, price: 2284.05 },
  { symbol: "IRCTC", pct: -1.06, price: 786.15 },
  { symbol: "SUNPHARMA", pct: -0.69, price: 1789.25 },
  { symbol: "BRITANNIA", pct: -0.58, price: 5312.4 },
  { symbol: "NESTLEIND", pct: -0.41, price: 2456.8 },
];

export const news = [
  {
    time: "14:52",
    source: "Reuters",
    title: "Auto stocks extend rally as festive dispatch numbers beat street estimates",
    tag: "Auto",
  },
  {
    time: "14:10",
    source: "Bloomberg",
    title: "RBI holds repo rate at 6.25%, signals durable disinflation ahead",
    tag: "Macro",
  },
  {
    time: "13:26",
    source: "Mint",
    title: "Electronics manufacturers see order book expand on new PLI tranche",
    tag: "Electronics",
  },
  {
    time: "12:04",
    source: "ET Markets",
    title: "FIIs turn net buyers for the fourth straight session, ₹3,120 cr inflow",
    tag: "Flows",
  },
];

export const breadth = {
  advancing: 1284,
  declining: 563,
  unchanged: 84,
  newHighs: 96,
  newLows: 21,
  aboveEma200: 68,
};

export const sectors = [
  { name: "Electronics", strength: 92, change: 2.4 },
  { name: "Auto", strength: 88, change: 1.9 },
  { name: "Defence", strength: 84, change: 1.6 },
  { name: "Capital Goods", strength: 76, change: 1.1 },
  { name: "IT", strength: 71, change: 0.8 },
  { name: "Banking", strength: 63, change: 0.4 },
  { name: "Pharma", strength: 48, change: -0.3 },
  { name: "FMCG", strength: 34, change: -0.9 },
];

export const watchlist = [
  { symbol: "TATAMOTORS", price: 1042.35, pct: 2.85, note: "Breakout retest" },
  { symbol: "PERSISTENT", price: 5688.1, pct: 2.2, note: "EMA 20 bounce" },
  { symbol: "JSWSTEEL", price: 968.4, pct: 1.97, note: "200 EMA reclaim" },
  { symbol: "INDIGO", price: 4611.85, pct: 1.01, note: "Watch 4,650 pivot" },
  { symbol: "SUNPHARMA", price: 1789.25, pct: -0.69, note: "Base building" },
];

export const alerts = [
  { symbol: "DIXON", rule: "Price crosses above ₹14,250", status: "Triggered", time: "14:38" },
  { symbol: "BEL", rule: "Trend score > 90", status: "Triggered", time: "13:55" },
  { symbol: "HDFCBANK", rule: "EMA 100 reclaim on close", status: "Armed", time: "—" },
  { symbol: "ASIANPAINT", rule: "Price falls below ₹2,250", status: "Armed", time: "—" },
];

export const positions = [
  { symbol: "TATAMOTORS", qty: 120, avg: 948.2, ltp: 1042.35 },
  { symbol: "BEL", qty: 400, avg: 372.5, ltp: 412.7 },
  { symbol: "POLYCAB", qty: 15, avg: 6410.0, ltp: 6740.5 },
  { symbol: "SUNPHARMA", qty: 60, avg: 1832.0, ltp: 1789.25 },
];

export const inr = (n: number | null | undefined) => {
  if (typeof n !== "number" || !Number.isFinite(n)) return "N/A";
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const pct = (n: number | null | undefined) => {
  if (typeof n !== "number" || !Number.isFinite(n)) return "N/A";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
};
