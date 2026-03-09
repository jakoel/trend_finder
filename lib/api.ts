import type { OHLCVBar, Timeframe, Ticker, MarketMeta } from "@/types";

// Yahoo Finance interval/range for the initial (recent) fetch
const TF_CONFIG: Record<Timeframe, { interval: string; range: string }> = {
  "1D": { interval: "1d",  range: "5y"  },
  "1W": { interval: "1wk", range: "20y" },
  "1M": { interval: "1mo", range: "30y" },
};

// How far back each historical back-fill batch reaches (in seconds)
const BACKFILL_SECONDS: Record<Timeframe, number> = {
  "1D": 3   * 365 * 86_400, // 3 years per batch
  "1W": 10  * 365 * 86_400, // 10 years per batch
  "1M": 20  * 365 * 86_400, // 20 years per batch
};

interface YahooQuote {
  open: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  close: (number | null)[];
  volume: (number | null)[];
}

interface YahooResult {
  meta: {
    regularMarketPrice: number;
    previousClose?: number;
    regularMarketPreviousClose?: number;
    shortName?: string;
    longName?: string;
    exchangeName?: string;
    fullExchangeName?: string;
    currency?: string;
  };
  timestamp: number[];
  indicators: { quote: YahooQuote[] };
}

interface YahooResponse {
  chart: {
    result: YahooResult[] | null;
    error: { code: string; description: string } | null;
  };
}

export interface FetchResult {
  bars: OHLCVBar[];
  meta: MarketMeta;
}

export async function fetchOHLCV(
  symbol: string,
  timeframe: Timeframe
): Promise<FetchResult> {
  const { interval, range } = TF_CONFIG[timeframe];
  const res = await fetch(
    `/api/chart?symbol=${encodeURIComponent(symbol)}&interval=${interval}&range=${range}`
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `Request failed with status ${res.status}`);
  }

  const data: YahooResponse = await res.json();

  if (data.chart.error) {
    throw new Error(data.chart.error.description);
  }

  const result = data.chart.result?.[0];
  if (!result) throw new Error(`No data returned for ${symbol}`);

  const { meta, timestamp, indicators } = result;
  const quote = indicators.quote[0];

  const bars: OHLCVBar[] = timestamp
    .map((t, i) => ({
      time: t,
      open: quote.open[i] ?? 0,
      high: quote.high[i] ?? 0,
      low: quote.low[i] ?? 0,
      close: quote.close[i] ?? 0,
      volume: quote.volume[i] ?? 0,
    }))
    .filter((b) => b.open > 0 && b.close > 0);

  const marketMeta: MarketMeta = {
    symbol,
    shortName: meta.shortName ?? meta.longName ?? symbol,
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? "",
    currency: meta.currency ?? "USD",
    regularMarketPrice: meta.regularMarketPrice,
    previousClose:
      meta.previousClose ?? meta.regularMarketPreviousClose ?? meta.regularMarketPrice,
  };

  return { bars, meta: marketMeta };
}

// Fetches bars strictly before `beforeUnixSec`, one BACKFILL_SECONDS-sized batch
export async function fetchOHLCVBefore(
  symbol: string,
  timeframe: Timeframe,
  beforeUnixSec: number
): Promise<OHLCVBar[]> {
  const { interval } = TF_CONFIG[timeframe];
  const batchSec = BACKFILL_SECONDS[timeframe];
  const period2 = beforeUnixSec - 1;
  const period1 = period2 - batchSec;

  const res = await fetch(
    `/api/chart?symbol=${encodeURIComponent(symbol)}&interval=${interval}&period1=${period1}&period2=${period2}`
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `Request failed with status ${res.status}`);
  }

  const data: YahooResponse = await res.json();

  if (data.chart.error) throw new Error(data.chart.error.description);

  const result = data.chart.result?.[0];
  if (!result) return [];

  const { timestamp, indicators } = result;
  const quote = indicators.quote[0];

  return timestamp
    .map((t, i) => ({
      time: t,
      open: quote.open[i] ?? 0,
      high: quote.high[i] ?? 0,
      low: quote.low[i] ?? 0,
      close: quote.close[i] ?? 0,
      volume: quote.volume[i] ?? 0,
    }))
    .filter((b) => b.open > 0 && b.close > 0);
}

export function searchTickers(query: string): Ticker[] {
  const q = query.toLowerCase();
  return POPULAR_TICKERS.filter(
    (t) =>
      t.symbol.toLowerCase().includes(q) || t.label.toLowerCase().includes(q)
  );
}

export const POPULAR_TICKERS: Ticker[] = [
  // Mega-cap tech
  { symbol: "AAPL", label: "Apple Inc.", exchange: "NASDAQ" },
  { symbol: "MSFT", label: "Microsoft Corp.", exchange: "NASDAQ" },
  { symbol: "NVDA", label: "NVIDIA Corp.", exchange: "NASDAQ" },
  { symbol: "GOOGL", label: "Alphabet Inc.", exchange: "NASDAQ" },
  { symbol: "AMZN", label: "Amazon.com Inc.", exchange: "NASDAQ" },
  { symbol: "META", label: "Meta Platforms Inc.", exchange: "NASDAQ" },
  { symbol: "TSLA", label: "Tesla Inc.", exchange: "NASDAQ" },
  { symbol: "AMD", label: "Advanced Micro Devices", exchange: "NASDAQ" },
  { symbol: "INTC", label: "Intel Corp.", exchange: "NASDAQ" },
  { symbol: "NFLX", label: "Netflix Inc.", exchange: "NASDAQ" },
  // Finance
  { symbol: "JPM", label: "JPMorgan Chase & Co.", exchange: "NYSE" },
  { symbol: "GS", label: "Goldman Sachs Group", exchange: "NYSE" },
  { symbol: "BAC", label: "Bank of America Corp.", exchange: "NYSE" },
  { symbol: "V", label: "Visa Inc.", exchange: "NYSE" },
  // Healthcare / Consumer
  { symbol: "JNJ", label: "Johnson & Johnson", exchange: "NYSE" },
  { symbol: "PFE", label: "Pfizer Inc.", exchange: "NYSE" },
  { symbol: "DIS", label: "Walt Disney Co.", exchange: "NYSE" },
  // ETFs
  { symbol: "SPY", label: "SPDR S&P 500 ETF Trust", exchange: "NYSE" },
  { symbol: "QQQ", label: "Invesco QQQ Trust", exchange: "NASDAQ" },
  { symbol: "IWM", label: "iShares Russell 2000 ETF", exchange: "NYSE" },
  // New tech / growth
  { symbol: "PLTR", label: "Palantir Technologies", exchange: "NYSE" },
  { symbol: "COIN", label: "Coinbase Global Inc.", exchange: "NASDAQ" },
  { symbol: "UBER", label: "Uber Technologies Inc.", exchange: "NYSE" },
  { symbol: "SHOP", label: "Shopify Inc.", exchange: "NYSE" },
  { symbol: "CRWD", label: "CrowdStrike Holdings", exchange: "NASDAQ" },
];
