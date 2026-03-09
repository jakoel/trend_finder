"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useLightweightChart } from "@/hooks/useLightweightChart";
import {
  getCachedBars,
  cacheBars,
  getCachedIndicatorOutput,
  cacheIndicatorOutput,
  makeSettingsKey,
  getHistoricalBars,
  cacheHistoricalBars,
} from "@/lib/db";
import { fetchOHLCV, fetchOHLCVBefore } from "@/lib/api";
import { runIndicatorEngine } from "@/lib/indicator-engine";
import type {
  Timeframe,
  CachedBar,
  MarketMeta,
  IndicatorSettings,
  IndicatorStats,
  OHLCVBar,
} from "@/types";

// 1D → fetch 1W as HTF, 1W → 1M, 1M → no HTF
const HTF_MAP: Partial<Record<Timeframe, Timeframe>> = {
  "1D": "1W",
  "1W": "1M",
};

interface Props {
  symbol: string;
  timeframe: Timeframe;
  settings: IndicatorSettings;
  onLoadingChange?: (loading: boolean) => void;
  onMetaUpdate?: (meta: MarketMeta | null) => void;
  onStatsChange?: (stats: IndicatorStats | null) => void;
}


export function TradingChart({ symbol, timeframe, settings, onLoadingChange, onMetaUpdate, onStatsChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const statsChangeCbRef = useRef(onStatsChange);
  statsChangeCbRef.current = onStatsChange;

  // Persisted across back-fill calls within the same symbol+timeframe session
  const allBarsRef = useRef<OHLCVBar[]>([]);
  const htfBarsRef = useRef<OHLCVBar[] | null>(null);
  const fetchingMoreRef = useRef(false);
  const noMoreHistoryRef = useRef(false);

  // Keep settings in a ref so the left-edge callback always sees the latest value
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Stable ref wrapper so the hook always calls the latest handler without re-mounting
  const leftEdgeHandlerRef = useRef<() => void>(() => { /* no-op until hook mounts */ });

  const { setCandles, setEMA, setATRStop, setMarkers } = useLightweightChart(
    containerRef,
    undefined,
    useCallback(() => leftEdgeHandlerRef.current(), [])
  );

  // Wire the real handler after setCandles/setEMA/setATRStop/setMarkers are available
  useEffect(() => {
    leftEdgeHandlerRef.current = async () => {
      if (fetchingMoreRef.current || noMoreHistoryRef.current) return;
      const earliest = allBarsRef.current[0]?.time;
      if (!earliest) return;

      fetchingMoreRef.current = true;
      try {
        const newBars = await fetchOHLCVBefore(symbol, timeframe, earliest);

        if (!newBars.length) {
          noMoreHistoryRef.current = true;
          return;
        }

        // Only keep bars we don't already have
        const existingTimes = new Set(allBarsRef.current.map((b) => b.time));
        const unique = newBars.filter((b) => !existingTimes.has(b.time));
        if (!unique.length) {
          noMoreHistoryRef.current = true;
          return;
        }

        // Persist to permanent historical store
        await cacheHistoricalBars(symbol, timeframe, unique);

        // Merge and sort all bars
        const merged = [...unique, ...allBarsRef.current].sort((a, b) => a.time - b.time);
        allBarsRef.current = merged;

        // Update chart preserving the current viewport
        setCandles(merged, true);

        // Re-run indicator engine on the expanded dataset
        const currentSettings = settingsRef.current;
        const newOutput = runIndicatorEngine(merged, htfBarsRef.current, currentSettings);

        // Persist updated indicator output
        const sKey = makeSettingsKey(currentSettings);
        cacheIndicatorOutput(symbol, timeframe, sKey, newOutput).catch(() => { /* non-fatal */ });

        setEMA(newOutput.ema200);
        setATRStop(newOutput.atrStop);
        setMarkers(newOutput.markers);
        statsChangeCbRef.current?.(newOutput.stats);
      } catch {
        // Non-fatal — user can scroll more to retry
      } finally {
        fetchingMoreRef.current = false;
      }
    };
  }, [symbol, timeframe, setCandles, setEMA, setATRStop, setMarkers]);

  useEffect(() => {
    let cancelled = false;

    // Reset back-fill state whenever symbol or timeframe changes
    allBarsRef.current = [];
    htfBarsRef.current = null;
    fetchingMoreRef.current = false;
    noMoreHistoryRef.current = false;

    async function load() {
      setError(null);
      onLoadingChange?.(true);
      onMetaUpdate?.(null);

      try {
        const sKey = makeSettingsKey(settings);

        // ── 1. Fresh bars (TTL-gated) ─────────────────────────────────────────
        let freshBars = await getCachedBars(symbol, timeframe);
        let barsFromCache = !!freshBars;
        let meta = null;

        if (!freshBars) {
          const result = await fetchOHLCV(symbol, timeframe);
          meta = result.meta;
          const now = Date.now();
          const cached: CachedBar[] = result.bars.map((b) => ({
            ...b, symbol, timeframe, fetchedAt: now,
          }));
          await cacheBars(symbol, timeframe, cached);
          freshBars = cached;
        }

        // ── 2. Merge with permanent historical bars ───────────────────────────
        const historicalBars = await getHistoricalBars(symbol, timeframe);
        let bars: OHLCVBar[];
        if (historicalBars.length && freshBars.length) {
          const freshEarliest = freshBars[0].time;
          const olderHistorical = historicalBars.filter((b) => b.time < freshEarliest);
          bars = [...olderHistorical, ...freshBars];
        } else {
          bars = freshBars;
        }

        // Store for back-fill reference
        allBarsRef.current = bars;

        if (cancelled) return;
        setCandles(bars);


        // ── 3. Indicator results (cached if bars were fully from cache) ────────
        let indicatorOutput = barsFromCache
          ? await getCachedIndicatorOutput(symbol, timeframe, sKey)
          : null;

        if (!indicatorOutput) {
          // ── 4. HTF bars (best-effort) ───────────────────────────────────────
          let htfBars: OHLCVBar[] | null = null;
          const htfTF = HTF_MAP[timeframe];
          if (htfTF) {
            try {
              let htfCached = await getCachedBars(symbol, htfTF);
              if (!htfCached) {
                const result = await fetchOHLCV(symbol, htfTF);
                if (!meta) meta = result.meta;
                const now = Date.now();
                const htfRows: CachedBar[] = result.bars.map((b) => ({
                  ...b, symbol, timeframe: htfTF, fetchedAt: now,
                }));
                await cacheBars(symbol, htfTF, htfRows);
                htfCached = htfRows;
              }
              htfBars = htfCached;
            } catch { /* non-fatal */ }
          }

          if (cancelled) return;

          htfBarsRef.current = htfBars;

          // ── 5. Run engine & persist ─────────────────────────────────────────
          indicatorOutput = runIndicatorEngine(bars, htfBars, settings);
          cacheIndicatorOutput(symbol, timeframe, sKey, indicatorOutput).catch(() => { /* non-fatal */ });
        }

        if (cancelled) return;

        setEMA(indicatorOutput.ema200);
        setATRStop(indicatorOutput.atrStop);
        setMarkers(indicatorOutput.markers);
        statsChangeCbRef.current?.(indicatorOutput.stats);

        if (meta) onMetaUpdate?.(meta);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        if (!cancelled) onLoadingChange?.(false);
      }
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe, setCandles, setEMA, setATRStop, setMarkers, onLoadingChange, onMetaUpdate]);

  // ── Settings-only effect: re-run engine without touching candles ──────────
  useEffect(() => {
    if (!allBarsRef.current.length) return;
    const output = runIndicatorEngine(allBarsRef.current, htfBarsRef.current, settings);
    const sKey = makeSettingsKey(settings);
    cacheIndicatorOutput(symbol, timeframe, sKey, output).catch(() => { /* non-fatal */ });
    setEMA(output.ema200);
    setATRStop(output.atrStop);
    setMarkers(output.markers);
    statsChangeCbRef.current?.(output.stats);
  }, [settings, symbol, timeframe, setEMA, setATRStop, setMarkers]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-sm px-5 py-3 rounded-lg border"
            style={{ color: "#ef5350", background: "#1a1217", borderColor: "#3d1a1a" }}>
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
