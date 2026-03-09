"use client";

import { useState, useEffect, useCallback } from "react";
import { TopNav } from "./navbar/TopNav";
import { TradingChart } from "./chart/TradingChart";
import { OllamaBar } from "./OllamaBar";
import { DEFAULT_SETTINGS } from "@/lib/indicator-engine";
import type { Timeframe, IndicatorSettings, IndicatorStats, ChartMarker, OHLCVBar } from "@/types";

// ── Horizontal indicator stats bar ──────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span className="flex items-baseline gap-1 shrink-0">
      <span style={{ color: "#3d4355", fontSize: 10, fontWeight: 600, letterSpacing: "0.04em" }}>
        {label}
      </span>
      <span style={{ color, fontSize: 11, fontWeight: 700 }}>
        {value}
      </span>
    </span>
  );
}

function Dot() {
  return <span style={{ color: "#1e2130", fontSize: 14, lineHeight: 1, userSelect: "none" }}>·</span>;
}

function StatsBar({ stats }: { stats: IndicatorStats }) {
  const rsiColor = stats.rsi >= 70 ? "#ef5350" : stats.rsi <= 30 ? "#26a69a" : "#d1d4dc";
  const adxColor = stats.adx >= 20 ? "#26a69a" : "#ef5350";
  const histColor = stats.histogram > 0
    ? (stats.histExpanding ? "#00E676" : "#81C784")
    : (stats.histExpanding ? "#ef5350" : "#E57373");
  const scoreVal = stats.histogram >= 0 ? stats.bullScore : stats.bearScore;
  const scoreColor = scoreVal >= 6 ? "#00E676" : scoreVal >= 4 ? "#81C784" : "#9E9E9E";

  return (
    <div className="flex items-center gap-2.5 select-none overflow-hidden">
      <StatChip label="TREND" value={stats.trend} color={stats.trendColor} />
      <Dot />
      <StatChip label="MOM" value={stats.momentum} color={stats.momentumColor} />
      <Dot />
      <StatChip label="RSI" value={stats.rsi.toFixed(1)} color={rsiColor} />
      <Dot />
      <StatChip label="ADX" value={stats.adx.toFixed(1)} color={adxColor} />
      <Dot />
      <StatChip label="HIST" value={stats.histogram.toFixed(4)} color={histColor} />
      <Dot />
      <StatChip label="VOL" value={`${stats.volume} ${stats.volumeRatio.toFixed(1)}×`} color={stats.volumeColor} />
      <Dot />
      <StatChip label="SCORE" value={`${scoreVal}/8`} color={scoreColor} />
      <Dot />
      <StatChip label="SIG" value={stats.signal} color={stats.signalColor} />
      {stats.warning !== "NONE" && (
        <>
          <Dot />
          <StatChip label="WARN" value={stats.warning} color={stats.warningColor} />
        </>
      )}
    </div>
  );
}

// ── Terminal ─────────────────────────────────────────────────────────────────

const LS_SYMBOL = "tf_last_symbol";
const LS_TIMEFRAME = "tf_last_timeframe";

export function TradingTerminal() {
  const [symbol, setSymbol] = useState<string>("AAPL");
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");

  useEffect(() => {
    const s = localStorage.getItem(LS_SYMBOL);
    const tf = localStorage.getItem(LS_TIMEFRAME);
    if (s) setSymbol(s);
    if (tf) setTimeframe(tf as Timeframe);
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<IndicatorSettings>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<IndicatorStats | null>(null);
  const [markers, setMarkers] = useState<ChartMarker[]>([]);
  const [bars, setBars] = useState<OHLCVBar[]>([]);

  const handleLoading = useCallback((v: boolean) => setIsLoading(v), []);
  const handleSettings = useCallback((s: IndicatorSettings) => setSettings(s), []);

  const handleSymbolChange = useCallback((s: string) => {
    setSymbol(s);
    localStorage.setItem(LS_SYMBOL, s);
  }, []);

  const handleTimeframeChange = useCallback((tf: Timeframe) => {
    setTimeframe(tf);
    localStorage.setItem(LS_TIMEFRAME, tf);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "#131722" }}>
      <TopNav
        symbol={symbol}
        timeframe={timeframe}
        isLoading={isLoading}
        settings={settings}
        onSymbolChange={handleSymbolChange}
        onTimeframeChange={handleTimeframeChange}
        onSettingsChange={handleSettings}
      />

      {/* ── Indicator stats bar ───────────────────────────────────────── */}
      {stats && (
        <div
          className="flex items-center shrink-0"
          style={{
            height: "30px",
            paddingLeft: "24px",
            paddingRight: "20px",
            background: "#0c0e14",
            borderBottom: "1px solid #1a1d27",
          }}
        >
          <StatsBar stats={stats} />
        </div>
      )}

      <main className="flex-1 overflow-hidden">
        <TradingChart
          symbol={symbol}
          timeframe={timeframe}
          settings={settings}
          onLoadingChange={handleLoading}
          onStatsChange={setStats}
          onMarkersChange={setMarkers}
          onBarsChange={setBars}
        />
      </main>

      <OllamaBar symbol={symbol} timeframe={timeframe} stats={stats} markers={markers} bars={bars} />
    </div>
  );
}
