"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useLightweightChart } from "@/hooks/useLightweightChart";
import { getAllBars, getLatestBarTime, upsertBars } from "@/lib/db";
import { fetchOHLCV, fetchOHLCVBefore } from "@/lib/api";
import { runIndicatorEngine } from "@/lib/indicator-engine";
import type { Timeframe, MarketMeta, IndicatorSettings, IndicatorStats, ChartMarker, OHLCVBar } from "@/types";

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
  onMarkersChange?: (markers: ChartMarker[]) => void;
  onBarsChange?: (bars: OHLCVBar[]) => void;
}

export function TradingChart({ symbol, timeframe, settings, onLoadingChange, onMetaUpdate, onStatsChange, onMarkersChange, onBarsChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const statsChangeCbRef = useRef(onStatsChange);
  statsChangeCbRef.current = onStatsChange;
  const markersChangeCbRef = useRef(onMarkersChange);
  markersChangeCbRef.current = onMarkersChange;

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

  // Wire the real left-edge back-fill handler
  useEffect(() => {
    leftEdgeHandlerRef.current = async () => {
      if (fetchingMoreRef.current || noMoreHistoryRef.current) return;
      const earliest = allBarsRef.current[0]?.time;
      if (!earliest) return;

      fetchingMoreRef.current = true;
      try {
        const newBars = await fetchOHLCVBefore(symbol, timeframe, earliest);

        if (!newBars.length) { noMoreHistoryRef.current = true; return; }

        const existingTimes = new Set(allBarsRef.current.map((b) => b.time));
        const unique = newBars.filter((b) => !existingTimes.has(b.time));
        if (!unique.length) { noMoreHistoryRef.current = true; return; }

        // Persist to the unified permanent store
        await upsertBars(symbol, timeframe, unique);

        const merged = [...unique, ...allBarsRef.current].sort((a, b) => a.time - b.time);
        allBarsRef.current = merged;

        setCandles(merged, true);

        const output = runIndicatorEngine(merged, htfBarsRef.current, settingsRef.current);
        setEMA(output.ema200);
        setATRStop(output.atrStop);
        setMarkers(output.markers);
        statsChangeCbRef.current?.(output.stats);
      } catch {
        // Non-fatal — user can scroll more to retry
      } finally {
        fetchingMoreRef.current = false;
      }
    };
  }, [symbol, timeframe, setCandles, setEMA, setATRStop, setMarkers]);

  // ── Main load effect ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    allBarsRef.current = [];
    htfBarsRef.current = null;
    fetchingMoreRef.current = false;
    noMoreHistoryRef.current = false;

    async function load() {
      setError(null);
      onLoadingChange?.(true);
      onMetaUpdate?.(null);

      try {
        // ── 1. Use stored bars if available, otherwise full fetch ─────────────
        const latestStored = await getLatestBarTime(symbol, timeframe);

        if (latestStored === null) {
          const result = await fetchOHLCV(symbol, timeframe);
          if (cancelled) return;
          await upsertBars(symbol, timeframe, result.bars);
          if (result.meta) onMetaUpdate?.(result.meta);
        }
        // If data already exists, use it as-is — no API call needed.
        // Historical candles don't change; new candles can be fetched on demand later.

        // ── 2. Load all bars from store (includes back-filled history) ─────────
        const bars = await getAllBars(symbol, timeframe);
        if (cancelled) return;

        allBarsRef.current = bars;
        setCandles(bars);

        // ── 3. HTF bars (best-effort, same incremental strategy) ───────────────
        let htfBars: OHLCVBar[] | null = null;
        const htfTF = HTF_MAP[timeframe];
        if (htfTF) {
          try {
            const htfLatest = await getLatestBarTime(symbol, htfTF);
            if (htfLatest === null) {
              const result = await fetchOHLCV(symbol, htfTF);
              await upsertBars(symbol, htfTF, result.bars);
            }
            htfBars = await getAllBars(symbol, htfTF);
          } catch { /* non-fatal */ }
        }

        if (cancelled) return;
        htfBarsRef.current = htfBars;

        // ── 4. Run indicator engine ────────────────────────────────────────────
        const output = runIndicatorEngine(bars, htfBars, settings);
        if (cancelled) return;

        setEMA(output.ema200);
        setATRStop(output.atrStop);
        setMarkers(output.markers);
        statsChangeCbRef.current?.(output.stats);
        // Pass full signal set + bars to Ollama regardless of display settings
        const fullOutput = runIndicatorEngine(bars, htfBars, {
          showSignals: true, showATRStop: true, showDivergence: true,
          showMomentum: true, useADXFilter: settings.useADXFilter,
        });
        markersChangeCbRef.current?.(fullOutput.markers);
        onBarsChange?.(bars);

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

  // ── Settings-only effect: re-run engine without touching candles ───────────
  useEffect(() => {
    if (!allBarsRef.current.length) return;
    const output = runIndicatorEngine(allBarsRef.current, htfBarsRef.current, settings);
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
