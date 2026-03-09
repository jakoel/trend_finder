import Dexie, { type Table } from "dexie";
import type { CachedBar, OHLCVBar, Timeframe } from "@/types";

// ── Schema ────────────────────────────────────────────────────────────────────

class TradingDB extends Dexie {
  bars!: Table<CachedBar>;

  constructor() {
    super("TradingDB");
    // v1–v4: legacy schemas (TTL cache + historicalBars + indicators table)
    this.version(3).stores({
      bars: "[symbol+timeframe+time], fetchedAt",
      indicators: "[symbol+timeframe+settingsKey], fetchedAt",
    });
    this.version(4).stores({
      bars: "[symbol+timeframe+time], fetchedAt",
      indicators: "[symbol+timeframe+settingsKey], fetchedAt",
      historicalBars: "[symbol+timeframe+time]",
    });
    // v5: single permanent bar store — no TTL, no separate historicalBars,
    //     no indicator cache. Drop legacy tables.
    this.version(5)
      .stores({
        bars: "[symbol+timeframe+time], [symbol+timeframe], fetchedAt",
        indicators: null,
        historicalBars: null,
      });
  }
}

export const db = new TradingDB();

// ── Bar store ─────────────────────────────────────────────────────────────────

/** Returns all stored bars for a symbol+timeframe, sorted ascending by time.
 *  Deduplicates by timestamp to guard against any legacy dirty data. */
export async function getAllBars(
  symbol: string,
  timeframe: Timeframe
): Promise<OHLCVBar[]> {
  const rows = await db.bars
    .where("[symbol+timeframe+time]")
    .between(
      [symbol, timeframe, Dexie.minKey],
      [symbol, timeframe, Dexie.maxKey]
    )
    .sortBy("time");

  // Deduplicate by time — keep last occurrence per timestamp
  const seen = new Map<number, OHLCVBar>();
  for (const row of rows) seen.set(row.time, row);
  return [...seen.values()].sort((a, b) => a.time - b.time);
}

/** Returns the latest stored bar timestamp, or null if none exist. */
export async function getLatestBarTime(
  symbol: string,
  timeframe: Timeframe
): Promise<number | null> {
  const row = await db.bars
    .where("[symbol+timeframe+time]")
    .between(
      [symbol, timeframe, Dexie.minKey],
      [symbol, timeframe, Dexie.maxKey]
    )
    .last();
  return row?.time ?? null;
}


/**
 * Upsert bars into the permanent store.
 * Uses bulkPut so existing bars are overwritten (handles the last in-progress
 * candle being updated on next fetch).
 */
export async function upsertBars(
  symbol: string,
  timeframe: Timeframe,
  bars: OHLCVBar[]
): Promise<void> {
  const now = Date.now();
  const rows: CachedBar[] = bars.map((b) => ({
    ...b,
    symbol,
    timeframe,
    fetchedAt: now,
  }));
  await db.bars.bulkPut(rows);
}
