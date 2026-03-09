"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import type { IndicatorStats, ChartMarker, Timeframe, OHLCVBar } from "@/types";

const OLLAMA_BASE = "http://localhost:11434";

interface Props {
  symbol: string;
  timeframe: Timeframe;
  stats: IndicatorStats | null;
  markers: ChartMarker[];
  bars: OHLCVBar[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function markerLabel(m: ChartMarker): string {
  if (m.category === "signal") return m.text === "CR" ? "Counter Rally" : "Counter Pullback";
  if (m.category === "rsiExtreme") return m.position === "aboveBar" ? "RSI Overbought" : "RSI Oversold";
  if (m.category === "divergence") return m.position === "belowBar" ? "Bull Divergence" : "Bear Divergence";
  if (m.category === "momentum") return m.position === "aboveBar" ? "Momentum Fading (bear)" : "Momentum Fading (bull)";
  return m.category;
}

function formatDay(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Lookback window per timeframe
const LOOKBACK_SECONDS: Record<Timeframe, number> = {
  "1D": 60  * 86_400,   // 60 days
  "1W": 180 * 86_400,   // 6 months
  "1M": 365 * 86_400,   // 12 months
};

function buildPrompt(
  symbol: string,
  timeframe: Timeframe,
  stats: IndicatorStats,
  markers: ChartMarker[],
  bars: OHLCVBar[],
): string {
  const lookbackStart = Date.now() / 1000 - LOOKBACK_SECONDS[timeframe];
  const recent = markers.filter((m) => m.time >= lookbackStart);

  // Build a price lookup map for O(1) access
  const priceMap = new Map(bars.map((b) => [b.time, b]));

  const signalLines = recent.length
    ? recent.map((m) => {
        const bar = priceMap.get(m.time);
        const price = bar
          ? ` (O:${bar.open.toFixed(2)} H:${bar.high.toFixed(2)} L:${bar.low.toFixed(2)} C:${bar.close.toFixed(2)})`
          : "";
        return `${formatDay(m.time)}: ${markerLabel(m)}${price}`;
      }).join("\n")
    : "none";

  const atrLabel = stats.atrStopColor === "#00E676"
    ? "BULLISH (price above stop)"
    : stats.atrStopColor === "#FF1744"
      ? "BEARISH (price below stop)"
      : "N/A";

  const ema200Str = stats.ema200 != null
    ? `${stats.ema200.toFixed(2)} (price is ${stats.lastPrice > stats.ema200 ? "ABOVE" : "BELOW"} EMA200)`
    : "N/A";

  return `You are a concise quantitative analyst focused on long-term investing, not short-term trading. Analyze ${symbol} on the ${timeframe} chart from a long-term perspective.

Current state: Trend=${stats.trend}, Momentum=${stats.momentum}, RSI=${stats.rsi.toFixed(1)}, ADX=${stats.adx.toFixed(1)}
Last price: ${stats.lastPrice.toFixed(2)} | EMA200: ${ema200Str}
ATR Trailing Stop: ${atrLabel}
Recent signals: ${signalLines}

Reply in exactly 2-3 sentences from a long-term investor's perspective. Cover: (1) trend direction and strength relative to EMA200 and ATR stop, (2) momentum quality — if RSI is overbought or oversold mention it explicitly, (3) key long-term risk or opportunity. Be direct. No disclaimers.`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OllamaBar({ symbol, timeframe, stats, markers, bars }: Props) {
  const [available, setAvailable] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const triggeredKeyRef = useRef("");

  useEffect(() => {
    fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) })
      .then((r) => setAvailable(r.ok))
      .catch(() => setAvailable(false));
  }, []);

  const generate = useCallback(async (s: IndicatorStats, m: ChartMarker[], b: OHLCVBar[]) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setAnalysis("");
    setLoading(true);

    try {
      const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2",
          prompt: buildPrompt(symbol, timeframe, s, m, b),
          stream: false,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) { setAnalysis("Ollama error."); return; }
      const data = await res.json();
      setAnalysis(data.response?.trim() ?? "No response.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setAnalysis("Could not reach Ollama.");
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    if (!available || !stats || !markers.length || !bars.length) return;
    const key = `${symbol}:${timeframe}`;
    if (triggeredKeyRef.current === key) return;
    triggeredKeyRef.current = key;
    generate(stats, markers, bars);
  }, [available, stats, markers, bars, symbol, timeframe, generate]);

  if (!available) return null;

  return (
    <div
      className="flex items-stretch shrink-0 select-none"
      style={{
        background: "linear-gradient(180deg, #0e1019 0%, #0a0c12 100%)",
        borderTop: "1px solid #1e2130",
        minHeight: "48px",
      }}
    >
      {/* ── Left label ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0" style={{ paddingLeft: "24px", paddingRight: "20px" }}>
        <Sparkles
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: loading ? "#a78bfa" : "#6b8cff" }}
        />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#6b8cff" }}>
          AI SUMMARY
        </span>

      </div>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div style={{ width: "1px", background: "#2a2e45", alignSelf: "stretch", margin: "26px 0" }} />

      {/* ── Analysis text ─────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center" style={{ paddingLeft: "20px", paddingRight: "20px" }}>
        <p
          className="leading-relaxed"
          style={{
            fontSize: 13,
            color: loading ? "#4c525e" : analysis ? "#b0b8cc" : "#3d4355",
            fontStyle: !analysis && !loading ? "italic" : "normal",
            transition: "color 0.3s",
          }}
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span style={{ color: "#4c525e" }}>Analyzing</span>
              <span className="animate-pulse" style={{ color: "#a78bfa" }}>···</span>
            </span>
          ) : (
            analysis || "Waiting for data…"
          )}
        </p>
      </div>

      {/* ── Refresh button ────────────────────────────────────────────── */}
      <div className="flex items-center px-4">
        <button
          onClick={() => { if (stats) { triggeredKeyRef.current = ""; generate(stats, markers, bars); } }}
          disabled={loading || !stats}
          className="flex items-center justify-center w-7 h-7 rounded-md cursor-pointer disabled:opacity-30 transition-all"
          style={{ background: "rgba(107,140,255,0.06)", border: "1px solid #252932" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(107,140,255,0.14)"; e.currentTarget.style.borderColor = "rgba(107,140,255,0.3)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(107,140,255,0.06)"; e.currentTarget.style.borderColor = "#252932"; }}
          title="Regenerate analysis"
        >
          <RefreshCw
            className={`w-3 h-3 ${loading ? "animate-spin" : ""}`}
            style={{ color: loading ? "#a78bfa" : "#6b8cff" }}
          />
        </button>
      </div>
    </div>
  );
}
