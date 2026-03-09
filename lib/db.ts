import Dexie, { type Table } from "dexie";
import type { CachedBar, OHLCVBar, Timeframe, IndicatorOutput } from "@/types";

// ── Schema types ──────────────────────────────────────────────────────────────

interface CachedIndicatorResult {
  symbol: string;
  timeframe: Timeframe;
  settingsKey: string;
  output: IndicatorOutput;
  fetchedAt: number;
}

class TradingDB extends Dexie {
  bars!: Table<CachedBar>;
  indicators!: Table<CachedIndicatorResult>;
  historicalBars!: Table<CachedBar>;

  constructor() {
    super("TradingDB");
    this.version(3).stores({
      bars: "[symbol+timeframe+time], fetchedAt",
      indicators: "[symbol+timeframe+settingsKey], fetchedAt",
    });
    // v4: adds historicalBars — permanent store for back-filled data, never TTL-expired
    this.version(4).stores({
      bars: "[symbol+timeframe+time], fetchedAt",
      indicators: "[symbol+timeframe+settingsKey], fetchedAt",
      historicalBars: "[symbol+timeframe+time]",
    });
  }
}

export const db = new TradingDB();

const STALE_MS = 5 * 60 * 1000; // 5 minutes

// ── Bar cache (fresh, TTL-gated) ──────────────────────────────────────────────

export async function getCachedBars(
  symbol: string,
  timeframe: Timeframe
): Promise<CachedBar[] | null> {
  const rows = await db.bars
    .where("[symbol+timeframe+time]")
    .between(
      [symbol, timeframe, Dexie.minKey],
      [symbol, timeframe, Dexie.maxKey]
    )
    .toArray();

  if (!rows.length) return null;

  const newest = Math.max(...rows.map((r) => r.fetchedAt));
  if (Date.now() - newest > STALE_MS) return null;

  return rows.sort((a, b) => a.time - b.time);
}

export async function cacheBars(
  symbol: string,
  timeframe: Timeframe,
  bars: CachedBar[]
): Promise<void> {
  await db.bars
    .where("[symbol+timeframe+time]")
    .between(
      [symbol, timeframe, Dexie.minKey],
      [symbol, timeframe, Dexie.maxKey]
    )
    .delete();
  await db.bars.bulkPut(bars);
}

export async function invalidateCache(
  symbol: string,
  timeframe: Timeframe
): Promise<void> {
  await db.bars
    .where("[symbol+timeframe+time]")
    .between(
      [symbol, timeframe, Dexie.minKey],
      [symbol, timeframe, Dexie.maxKey]
    )
    .delete();
  await db.indicators
    .where("[symbol+timeframe+settingsKey]")
    .between(
      [symbol, timeframe, Dexie.minKey],
      [symbol, timeframe, Dexie.maxKey]
    )
    .delete();
}

// ── Historical bar store (permanent, no TTL) ──────────────────────────────────

export async function getHistoricalBars(
  symbol: string,
  timeframe: Timeframe
): Promise<CachedBar[]> {
  return db.historicalBars
    .where("[symbol+timeframe+time]")
    .between(
      [symbol, timeframe, Dexie.minKey],
      [symbol, timeframe, Dexie.maxKey]
    )
    .sortBy("time");
}

export async function cacheHistoricalBars(
  symbol: string,
  timeframe: Timeframe,
  bars: OHLCVBar[]
): Promise<void> {
  const rows: CachedBar[] = bars.map((b) => ({
    ...b,
    symbol,
    timeframe,
    fetchedAt: Date.now(),
  }));
  await db.historicalBars.bulkPut(rows);
}

export async function getEarliestHistoricalTime(
  symbol: string,
  timeframe: Timeframe
): Promise<number | null> {
  const row = await db.historicalBars
    .where("[symbol+timeframe+time]")
    .between(
      [symbol, timeframe, Dexie.minKey],
      [symbol, timeframe, Dexie.maxKey]
    )
    .first();
  return row?.time ?? null;
}

// ── Indicator result cache ────────────────────────────────────────────────────

// Bump this whenever marker rendering logic changes (size, shape, color, etc.)
// to invalidate all cached indicator outputs.
const INDICATOR_CACHE_VERSION = 3;

export function makeSettingsKey(s: {
  showSignals: boolean;
  showATRStop: boolean;
  showDivergence: boolean;
  showMomentum: boolean;
  useADXFilter: boolean;
}): string {
  return [
    s.showSignals, s.showATRStop,
    s.showDivergence, s.showMomentum, s.useADXFilter,
  ]
    .map((b) => (b ? "1" : "0"))
    .join("") + `_v${INDICATOR_CACHE_VERSION}`;
}

export async function getCachedIndicatorOutput(
  symbol: string,
  timeframe: Timeframe,
  settingsKey: string
): Promise<IndicatorOutput | null> {
  const row = await db.indicators
    .where("[symbol+timeframe+settingsKey]")
    .equals([symbol, timeframe, settingsKey])
    .first();

  if (!row) return null;
  if (Date.now() - row.fetchedAt > STALE_MS) return null;

  return row.output;
}

export async function cacheIndicatorOutput(
  symbol: string,
  timeframe: Timeframe,
  settingsKey: string,
  output: IndicatorOutput
): Promise<void> {
  await db.indicators.put({ symbol, timeframe, settingsKey, output, fetchedAt: Date.now() });
}
