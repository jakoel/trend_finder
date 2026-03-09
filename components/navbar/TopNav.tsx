"use client";

import { TrendingUp } from "lucide-react";
import { TickerSearch } from "./TickerSearch";
import { TimeframeSelector } from "./TimeframeSelector";
import { IndicatorToggles } from "./IndicatorToggles";
import type { Timeframe, IndicatorSettings } from "@/types";

interface Props {
  symbol: string;
  timeframe: Timeframe;
  isLoading: boolean;
  settings: IndicatorSettings;
  onSymbolChange: (s: string) => void;
  onTimeframeChange: (tf: Timeframe) => void;
  onSettingsChange: (s: IndicatorSettings) => void;
}

export function TopNav({
  symbol,
  timeframe,
  isLoading,
  settings,
  onSymbolChange,
  onTimeframeChange,
  onSettingsChange,
}: Props) {

  return (
    <header
      className="flex items-center shrink-0"
      style={{
        height: "56px",
        paddingLeft: "24px",
        paddingRight: "20px",
        background: "#0f1117",
        borderBottom: "1px solid #1e2130",
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 select-none shrink-0" style={{ marginRight: "32px" }}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #2962ff 0%, #1a4fd6 100%)" }}
        >
          <TrendingUp className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <span
          className="text-[14px] font-bold hidden md:block"
          style={{ color: "#e0e3eb", letterSpacing: "-0.03em" }}
        >
          TrendFinder
        </span>
      </div>

      {/* ── Symbol + Timeframe (grouped) ──────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">
        <TickerSearch symbol={symbol} onSelect={onSymbolChange} />

        {/* Subtle separator dot */}
        <span style={{ color: "#2a2e39", fontSize: "18px", lineHeight: 1, userSelect: "none" }}>·</span>

        <TimeframeSelector selected={timeframe} onChange={onTimeframeChange} />
      </div>


      {isLoading && (
        <span
          className="text-[11px] animate-pulse ml-3"
          style={{ color: "#3d4355" }}
        >
          Loading…
        </span>
      )}

      {/* ── Spacer ────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Indicator toggles — right edge ───────────────────────────── */}
      <IndicatorToggles settings={settings} onChange={onSettingsChange} />
    </header>
  );
}
