/**
 * MACD & RSI Smart Momentum Pro — orchestrator.
 *
 * Wires together the math primitives, pivot detection, divergence scan,
 * signal pipeline, and ATR trailing stop into a single IndicatorOutput.
 */

import type { OHLCVBar, IndicatorSettings, IndicatorOutput, ChartMarker } from "@/types";
import { ema, sma, computeRSI, computeMACD, computeATR, computeDMI } from "./math/indicators";
import { pivotHigh, pivotLow, buildHTFLookup } from "./math/pivots";
import { P, C } from "./engine/constants";
import { scanDivergence } from "./engine/divergence";
import { computeSignals } from "./engine/signals";
import { computeATRStop } from "./engine/atr-stop";

export const DEFAULT_SETTINGS: IndicatorSettings = {
  showSignals: false,
  showATRStop: true,
  showDivergence: false,
  showMomentum: false,
  useADXFilter: true,
};

export function runIndicatorEngine(
  bars: OHLCVBar[],
  htfBars: OHLCVBar[] | null,
  settings: IndicatorSettings
): IndicatorOutput {
  const n = bars.length;
  if (n < P.macdSlow + P.macdSignal) {
    return { ema200: [], atrStop: [], markers: [], stats: null };
  }

  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const volumes = bars.map((b) => b.volume);

  // ── Core series ────────────────────────────────────────────────────────────
  const { macdLine, signalLine, hist } = computeMACD(closes, P.macdFast, P.macdSlow, P.macdSignal);
  const rsiArr = computeRSI(closes, P.rsiLen);
  const ema200Arr = ema(closes, P.emaLen);
  const atrArr = computeATR(bars, P.atrLen);
  const { adx: adxArr } = computeDMI(bars, P.adxLen);
  const volMA = sma(volumes, P.volMALen);

  // ── HTF lookup ─────────────────────────────────────────────────────────────
  const htfLookup = htfBars ? buildHTFLookup(htfBars, P.emaLen) : null;

  // ── Pivot arrays for divergence ────────────────────────────────────────────
  const lb = P.divLookback;
  const pivHPrice = pivotHigh(highs, lb, lb);
  const pivLPrice = pivotLow(lows, lb, lb);
  const pivHRSI = pivotHigh(rsiArr, lb, lb);
  const pivLRSI = pivotLow(rsiArr, lb, lb);
  const pivHHist = pivotHigh(hist, lb, lb);
  const pivLHist = pivotLow(hist, lb, lb);

  // ── Divergence scan ────────────────────────────────────────────────────────
  const { rsiBullDiv, rsiBearDiv, macdBullDiv, macdBearDiv } = scanDivergence({
    n, pivHPrice, pivLPrice, pivHRSI, pivLRSI, pivHHist, pivLHist, highs, lows,
  });

  // ── Signal pipeline ────────────────────────────────────────────────────────
  const {
    rawBullScore, rawBearScore,
    finalConfirmedBuy, finalConfirmedSell, finalStdBuy, finalStdSell,
    counterRally, counterPullback, pullbackWarn, rallyWarn,
    histAccel, histDecel,
  } = computeSignals({
    n, bars, closes, hist, macdLine, signalLine, rsiArr, ema200Arr,
    adxArr, volMA, volumes, rsiBullDiv, rsiBearDiv, macdBullDiv, macdBearDiv, htfLookup,
  });

  // ── ATR Trailing Stop ──────────────────────────────────────────────────────
  const atrStopOut = computeATRStop(
    bars, closes, atrArr,
    finalConfirmedBuy, finalStdBuy, finalConfirmedSell, finalStdSell,
    settings.showATRStop
  );

  // ── EMA 200 output ─────────────────────────────────────────────────────────
  const ema200Out = bars
    .map((b, i) => ({ time: b.time, value: ema200Arr[i] }))
    .filter((p) => !isNaN(p.value));

  // ── Markers ────────────────────────────────────────────────────────────────
  const MARKER_SIZE = 0.24;
  const RSI_MARKER_SIZE = MARKER_SIZE / 4; // 0.06
  const markers: ChartMarker[] = [];

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const h = hist[i];
    const r = rsiArr[i];
    const vRatio = volMA[i] > 0 ? volumes[i] / volMA[i] : 0;

    // CR / CP counter-trend signals
    if (settings.showSignals) {
      if (counterRally[i]) {
        markers.push({ time: t, position: "belowBar", shape: "circle", color: C.counterBull, text: "CR", size: MARKER_SIZE, category: "signal" });
      }
      if (counterPullback[i]) {
        markers.push({ time: t, position: "aboveBar", shape: "circle", color: C.counterBear, text: "CP", size: MARKER_SIZE, category: "signal" });
      }
    }

    // RSI extreme warnings — square marker
    if (settings.showSignals && !isNaN(r) && !isNaN(h)) {
      if (r >= P.rsiOverbought && h > 0 && rawBullScore[i] >= P.minScore) {
        markers.push({ time: t, position: "aboveBar", shape: "circle", color: "#FF1744", text: "", size: RSI_MARKER_SIZE, category: "rsiExtreme" });
      }
      if (r <= P.rsiOversold && h < 0 && rawBearScore[i] >= P.minScore) {
        markers.push({ time: t, position: "belowBar", shape: "circle", color: "#00E676", text: "", size: RSI_MARKER_SIZE, category: "rsiExtreme" });
      }
    }

    // Divergence markers
    if (settings.showDivergence) {
      if (rsiBullDiv[i] || macdBullDiv[i]) markers.push({ time: t, position: "belowBar", shape: "arrowUp", color: "#26a69a", text: "", size: MARKER_SIZE, category: "divergence" });
      if (rsiBearDiv[i] || macdBearDiv[i]) markers.push({ time: t, position: "aboveBar", shape: "arrowDown", color: "#ef5350", text: "", size: MARKER_SIZE, category: "divergence" });
    }

    // Momentum fading markers — RSI slope must confirm direction
    if (settings.showMomentum && !isNaN(h)) {
      const prevH = i >= P.accelLookback ? hist[i - P.accelLookback] : NaN;
      const rsiSlope = i >= 3 ? rsiArr[i] - rsiArr[i - 3] : NaN;
      if (histDecel[i] && h > 0 && !isNaN(prevH) && prevH > 0 && !isNaN(rsiSlope) && rsiSlope < 0) {
        markers.push({ time: t, position: "belowBar", shape: "arrowUp", color: "#FF9800", text: "", size: MARKER_SIZE, category: "momentum" });
      }
      if (histDecel[i] && h < 0 && !isNaN(prevH) && prevH < 0 && !isNaN(rsiSlope) && rsiSlope > 0) {
        markers.push({ time: t, position: "aboveBar", shape: "arrowDown", color: "#FF9800", text: "", size: MARKER_SIZE, category: "momentum" });
      }
    }

    void vRatio; // reserved for future low-volume marker (see GAP_ANALYSIS.md §1d)
  }

  // ── Deduplicate: one marker per (time, position) slot, highest priority wins
  const PRIORITY: Record<ChartMarker["category"], number> = {
    signal: 0, rsiExtreme: 1, divergence: 2, momentum: 3, volume: 4,
  };
  const slotMap = new Map<string, ChartMarker>();
  for (const m of markers) {
    const key = `${m.time}:${m.position}`;
    const existing = slotMap.get(key);
    if (!existing || PRIORITY[m.category] < PRIORITY[existing.category]) {
      slotMap.set(key, m);
    }
  }
  const dedupedMarkers = [...slotMap.values()].sort((a, b) => a.time - b.time);

  // ── Stats for info panel (last bar) ───────────────────────────────────────
  let stats = null;
  const li = n - 1;
  const hr = rsiArr[li];
  const ha = adxArr[li];
  const hh = hist[li];

  if (!isNaN(hr) && !isNaN(ha) && !isNaN(hh)) {
    const e200 = ema200Arr[li];
    const aboveEMA = !isNaN(e200) && closes[li] > e200;
    const vRatio = volMA[li] > 0 ? volumes[li] / volMA[li] : 0;
    const volSurge = vRatio >= P.volSurge;
    const aboveAvg = vRatio >= 1.0;
    const lowVol = vRatio < 0.7;
    const histExp = !isNaN(hist[li - 1]) && Math.abs(hh) > Math.abs(hist[li - 1]);

    let signal = "NEUTRAL";
    let signalColor = C.neutral;
    if (finalConfirmedBuy[li]) { signal = "CONFIRMED BUY"; signalColor = C.confirmedBuy; }
    else if (finalConfirmedSell[li]) { signal = "CONFIRMED SELL"; signalColor = C.confirmedSell; }
    else if (finalStdBuy[li]) { signal = "STANDARD BUY"; signalColor = C.standardBuy; }
    else if (finalStdSell[li]) { signal = "STANDARD SELL"; signalColor = C.standardSell; }
    else if (counterRally[li]) { signal = "COUNTER RALLY"; signalColor = C.counterBull; }
    else if (counterPullback[li]) { signal = "COUNTER PULL"; signalColor = C.counterBear; }
    else if (pullbackWarn[li]) { signal = "PULLBACK WARN"; signalColor = C.pullbackWarn; }
    else if (rallyWarn[li]) { signal = "RALLY WARN"; signalColor = C.rallyWarn; }

    let warning = "NONE";
    let warningColor = C.neutral;
    const anyBullDiv = rsiBullDiv[li] || macdBullDiv[li];
    const anyBearDiv = rsiBearDiv[li] || macdBearDiv[li];
    if (anyBearDiv && hh > 0 && rawBullScore[li] >= P.minScore) { warning = "⚠ TOP FORMING"; warningColor = "#F44336"; }
    else if (anyBullDiv && hh < 0 && rawBearScore[li] >= P.minScore) { warning = "⚠ BOTTOM FORMING"; warningColor = "#26a69a"; }
    else if (histDecel[li] && hh > 0) { warning = "↓ BULL FADING"; warningColor = "#FF8A65"; }
    else if (histDecel[li] && hh < 0) { warning = "↑ BEAR FADING"; warningColor = "#FF8A65"; }
    else if (hr >= P.rsiOverbought) { warning = "OVERBOUGHT"; warningColor = "#F44336"; }
    else if (hr <= P.rsiOversold) { warning = "OVERSOLD"; warningColor = "#26a69a"; }
    else if (vRatio < 0.7) { warning = "LOW VOLUME"; warningColor = C.neutral; }

    stats = {
      rsi: hr,
      adx: ha,
      histogram: hh,
      histExpanding: histExp,
      bullScore: rawBullScore[li],
      bearScore: rawBearScore[li],
      signal,
      signalColor,
      warning,
      warningColor,
      trend: aboveEMA ? "BULLISH" : "BEARISH",
      trendColor: aboveEMA ? C.confirmedBuy : C.confirmedSell,
      momentum: histAccel[li] ? "ACCELERATING" : histDecel[li] ? "DECELERATING" : "STABLE",
      momentumColor: histAccel[li] ? C.confirmedBuy : histDecel[li] ? "#FF8A65" : C.neutral,
      volume: volSurge ? "SURGE" : aboveAvg ? "ABOVE AVG" : lowVol ? "LOW" : "AVERAGE",
      volumeColor: volSurge ? C.confirmedBuy : aboveAvg ? "#d1d4dc" : lowVol ? "#F44336" : C.neutral,
      volumeRatio: vRatio,
      lastPrice: closes[li],
      ema200: !isNaN(e200) ? e200 : null,
      atrStopColor: atrStopOut[atrStopOut.length - 1]?.color ?? null,
    };
  }

  return { ema200: ema200Out, atrStop: atrStopOut, markers: dedupedMarkers, stats };
}
