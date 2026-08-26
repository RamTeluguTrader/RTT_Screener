/**
 * The production RTT 2.X screener universe: real, verified NSE equities with
 * their Upstox instrument keys (ISIN-based, e.g. "NSE_EQ|INE066F01020"),
 * verified against the public Upstox NSE instrument master during the RTT
 * research phase. This is a curated starting universe, not a hard ceiling —
 * `resolveInstrumentKey` is the single seam to swap in a live instrument-master
 * lookup (fetch + search the full NSE equity list) to expand coverage beyond
 * these symbols without touching any other part of the pipeline.
 *
 * No prices, scores, or candles are stored here — those are always fetched
 * live from Upstox and computed by the real RTT 2.X engine.
 */
export type UniverseStock = {
  symbol: string;
  companyName: string;
  sector: string;
  instrumentKey: string;
};

export const SECTOR_NAMES = [
  "Defence",
  "Power",
  "IT",
  "Banking",
  "Financial Services",
  "Auto",
  "Pharmaceuticals",
  "FMCG",
  "Industrials",
  "Energy",
] as const;
export type SectorName = (typeof SECTOR_NAMES)[number];

const SECTOR_STOCKS: Record<SectorName, { symbol: string; companyName: string; instrumentKey: string }[]> = {
  Defence: [
    { symbol: "HAL", companyName: "Hindustan Aeronautics Ltd", instrumentKey: "NSE_EQ|INE066F01020" },
    { symbol: "BEL", companyName: "Bharat Electronics Ltd", instrumentKey: "NSE_EQ|INE263A01024" },
    { symbol: "BDL", companyName: "Bharat Dynamics Ltd", instrumentKey: "NSE_EQ|INE171Z01026" },
    { symbol: "MAZDOCK", companyName: "Mazagon Dock Shipbuilders Ltd", instrumentKey: "NSE_EQ|INE249Z01020" },
    { symbol: "ASTRAMICRO", companyName: "Astra Microwave Products Ltd", instrumentKey: "NSE_EQ|INE386C01029" },
    { symbol: "PARAS", companyName: "Paras Defence and Space Technologies Ltd", instrumentKey: "NSE_EQ|INE045601023" },
  ],
  Power: [
    { symbol: "NTPC", companyName: "NTPC Ltd", instrumentKey: "NSE_EQ|INE733E01010" },
    { symbol: "POWERGRID", companyName: "Power Grid Corporation of India Ltd", instrumentKey: "NSE_EQ|INE752E01010" },
    { symbol: "TATAPOWER", companyName: "Tata Power Company Ltd", instrumentKey: "NSE_EQ|INE245A01021" },
    { symbol: "JSWENERGY", companyName: "JSW Energy Ltd", instrumentKey: "NSE_EQ|INE121E01018" },
    { symbol: "SJVN", companyName: "SJVN Ltd", instrumentKey: "NSE_EQ|INE002L01015" },
    { symbol: "NHPC", companyName: "NHPC Ltd", instrumentKey: "NSE_EQ|INE848E01016" },
  ],
  IT: [
    { symbol: "TCS", companyName: "Tata Consultancy Services Ltd", instrumentKey: "NSE_EQ|INE467B01029" },
    { symbol: "INFY", companyName: "Infosys Ltd", instrumentKey: "NSE_EQ|INE009A01021" },
    { symbol: "HCLTECH", companyName: "HCL Technologies Ltd", instrumentKey: "NSE_EQ|INE860A01027" },
    { symbol: "COFORGE", companyName: "Coforge Ltd", instrumentKey: "NSE_EQ|INE591G01025" },
    { symbol: "WIPRO", companyName: "Wipro Ltd", instrumentKey: "NSE_EQ|INE075A01022" },
    { symbol: "TECHM", companyName: "Tech Mahindra Ltd", instrumentKey: "NSE_EQ|INE669C01036" },
  ],
  Banking: [
    { symbol: "HDFCBANK", companyName: "HDFC Bank Ltd", instrumentKey: "NSE_EQ|INE040A01034" },
    { symbol: "ICICIBANK", companyName: "ICICI Bank Ltd", instrumentKey: "NSE_EQ|INE090A01021" },
    { symbol: "SBIN", companyName: "State Bank of India", instrumentKey: "NSE_EQ|INE062A01020" },
    { symbol: "AXISBANK", companyName: "Axis Bank Ltd", instrumentKey: "NSE_EQ|INE238A01034" },
    { symbol: "KOTAKBANK", companyName: "Kotak Mahindra Bank Ltd", instrumentKey: "NSE_EQ|INE237A01036" },
    { symbol: "INDUSINDBK", companyName: "IndusInd Bank Ltd", instrumentKey: "NSE_EQ|INE095A01012" },
  ],
  "Financial Services": [
    { symbol: "BAJFINANCE", companyName: "Bajaj Finance Ltd", instrumentKey: "NSE_EQ|INE296A01032" },
    { symbol: "BAJAJFINSV", companyName: "Bajaj Finserv Ltd", instrumentKey: "NSE_EQ|INE918I01026" },
    { symbol: "HDFCLIFE", companyName: "HDFC Life Insurance Company Ltd", instrumentKey: "NSE_EQ|INE795G01014" },
    { symbol: "SBILIFE", companyName: "SBI Life Insurance Company Ltd", instrumentKey: "NSE_EQ|INE123W01016" },
    { symbol: "MUTHOOTFIN", companyName: "Muthoot Finance Ltd", instrumentKey: "NSE_EQ|INE414G01012" },
    { symbol: "CHOLAFIN", companyName: "Cholamandalam Investment and Finance Company Ltd", instrumentKey: "NSE_EQ|INE121A01024" },
  ],
  Auto: [
    { symbol: "M&M", companyName: "Mahindra & Mahindra Ltd", instrumentKey: "NSE_EQ|INE101A01026" },
    { symbol: "MARUTI", companyName: "Maruti Suzuki India Ltd", instrumentKey: "NSE_EQ|INE585B01010" },
    { symbol: "TMCV", companyName: "Tata Motors Ltd", instrumentKey: "NSE_EQ|INE1TAE01010" },
    { symbol: "BAJAJ-AUTO", companyName: "Bajaj Auto Ltd", instrumentKey: "NSE_EQ|INE917I01010" },
    { symbol: "EICHERMOT", companyName: "Eicher Motors Ltd", instrumentKey: "NSE_EQ|INE066A01021" },
    { symbol: "TVSMOTOR", companyName: "TVS Motor Company Ltd", instrumentKey: "NSE_EQ|INE494B01023" },
  ],
  Pharmaceuticals: [
    { symbol: "SUNPHARMA", companyName: "Sun Pharmaceutical Industries Ltd", instrumentKey: "NSE_EQ|INE044A01036" },
    { symbol: "DRREDDY", companyName: "Dr. Reddy's Laboratories Ltd", instrumentKey: "NSE_EQ|INE089A01031" },
    { symbol: "CIPLA", companyName: "Cipla Ltd", instrumentKey: "NSE_EQ|INE059A01026" },
    { symbol: "DIVISLAB", companyName: "Divi's Laboratories Ltd", instrumentKey: "NSE_EQ|INE361B01024" },
    { symbol: "LUPIN", companyName: "Lupin Ltd", instrumentKey: "NSE_EQ|INE326A01037" },
    { symbol: "AUROPHARMA", companyName: "Aurobindo Pharma Ltd", instrumentKey: "NSE_EQ|INE406A01037" },
  ],
  FMCG: [
    { symbol: "ITC", companyName: "ITC Ltd", instrumentKey: "NSE_EQ|INE154A01025" },
    { symbol: "HINDUNILVR", companyName: "Hindustan Unilever Ltd", instrumentKey: "NSE_EQ|INE030A01027" },
    { symbol: "BRITANNIA", companyName: "Britannia Industries Ltd", instrumentKey: "NSE_EQ|INE216A01030" },
    { symbol: "NESTLEIND", companyName: "Nestle India Ltd", instrumentKey: "NSE_EQ|INE239A01024" },
    { symbol: "DABUR", companyName: "Dabur India Ltd", instrumentKey: "NSE_EQ|INE016A01026" },
    { symbol: "GODREJCP", companyName: "Godrej Consumer Products Ltd", instrumentKey: "NSE_EQ|INE102D01028" },
  ],
  Industrials: [
    { symbol: "SIEMENS", companyName: "Siemens Ltd", instrumentKey: "NSE_EQ|INE003A01024" },
    { symbol: "ABB", companyName: "ABB India Ltd", instrumentKey: "NSE_EQ|INE117A01022" },
    { symbol: "THERMAX", companyName: "Thermax Ltd", instrumentKey: "NSE_EQ|INE152A01029" },
    { symbol: "CUMMINSIND", companyName: "Cummins India Ltd", instrumentKey: "NSE_EQ|INE298A01020" },
    { symbol: "LT", companyName: "Larsen & Toubro Ltd", instrumentKey: "NSE_EQ|INE018A01030" },
    { symbol: "VOLTAS", companyName: "Voltas Ltd", instrumentKey: "NSE_EQ|INE226A01021" },
  ],
  Energy: [
    { symbol: "RELIANCE", companyName: "Reliance Industries Ltd", instrumentKey: "NSE_EQ|INE002A01018" },
    { symbol: "ONGC", companyName: "Oil and Natural Gas Corporation Ltd", instrumentKey: "NSE_EQ|INE213A01029" },
    { symbol: "COALINDIA", companyName: "Coal India Ltd", instrumentKey: "NSE_EQ|INE522F01014" },
    { symbol: "OIL", companyName: "Oil India Ltd", instrumentKey: "NSE_EQ|INE274J01014" },
    { symbol: "GAIL", companyName: "GAIL (India) Ltd", instrumentKey: "NSE_EQ|INE129A01019" },
    { symbol: "BPCL", companyName: "Bharat Petroleum Corporation Ltd", instrumentKey: "NSE_EQ|INE029A01011" },
  ],
};

export const RTT2X_UNIVERSE: readonly UniverseStock[] = SECTOR_NAMES.flatMap((sector) =>
  SECTOR_STOCKS[sector].map((stock) => ({ ...stock, sector })),
);

const BY_SYMBOL = new Map(RTT2X_UNIVERSE.map((stock) => [stock.symbol, stock]));

export function findUniverseStock(symbol: string): UniverseStock | null {
  return BY_SYMBOL.get(symbol) ?? null;
}

/** Seam for a future live instrument-master lookup; currently backed by the static universe above. */
export function resolveInstrumentKey(symbol: string): string | null {
  return BY_SYMBOL.get(symbol)?.instrumentKey ?? null;
}
