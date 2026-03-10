/**
 * Signal computation pipeline:
 *   MACD crossovers → momentum acceleration → confluence scoring →
 *   raw classification → confirmation window → cooldown → counter-trend & warnings
 */

import type { OHLCVBar } from "@/types";
import { P } from "./constants";

type HTFLookup = ((t: number) => { emaValue: number; close: number } | null) | null;

export interface SignalsInput {
  n: number;
  bars: OHLCVBar[];
  closes: number[];
  hist: number[];
  macdLine: number[];
  signalLine: number[];
  rsiArr: number[];
  ema200Arr: number[];
  adxArr: number[];
  volMA: number[];
  volumes: number[];
  rsiBullDiv: boolean[];
  rsiBearDiv: boolean[];
  macdBullDiv: boolean[];
  macdBearDiv: boolean[];
  htfLookup: HTFLookup;
}

export interface SignalsOutput {
  rawBullScore: number[];
  rawBearScore: number[];
  finalConfirmedBuy: boolean[];
  finalConfirmedSell: boolean[];
  finalStdBuy: boolean[];
  finalStdSell: boolean[];
  counterRally: boolean[];
  counterPullback: boolean[];
  pullbackWarn: boolean[];
  rallyWarn: boolean[];
  histAccel: boolean[];
  histDecel: boolean[];
}

function applyConfirmation(raw: boolean[], n: number): boolean[] {
  const out: boolean[] = new Array(n).fill(false);
  for (let i = P.confirmBars - 1; i < n; i++) {
    let ok = true;
    for (let k = 0; k < P.confirmBars; k++) {
      if (!raw[i - k]) { ok = false; break; }
    }
    out[i] = ok;
  }
  return out;
}

export function computeSignals(input: SignalsInput): SignalsOutput {
  const {
    n, bars, closes, hist, macdLine, signalLine, rsiArr, ema200Arr,
    adxArr, volMA, volumes, rsiBullDiv, rsiBearDiv, macdBullDiv, macdBearDiv, htfLookup,
  } = input;

  // ── MACD crossovers ────────────────────────────────────────────────────────
  const macdBullCross: boolean[] = new Array(n).fill(false);
  const macdBearCross: boolean[] = new Array(n).fill(false);
  for (let i = 1; i < n; i++) {
    if (isNaN(macdLine[i]) || isNaN(signalLine[i])) continue;
    if (macdLine[i] > signalLine[i] && macdLine[i - 1] <= signalLine[i - 1]) macdBullCross[i] = true;
    if (macdLine[i] < signalLine[i] && macdLine[i - 1] >= signalLine[i - 1]) macdBearCross[i] = true;
  }

  // Lookback window: true if a cross occurred within last macdCrossLB bars
  const bullCrossLB: boolean[] = new Array(n).fill(false);
  const bearCrossLB: boolean[] = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < P.macdCrossLB; k++) {
      if (i - k >= 0 && macdBullCross[i - k]) { bullCrossLB[i] = true; break; }
    }
    for (let k = 0; k < P.macdCrossLB; k++) {
      if (i - k >= 0 && macdBearCross[i - k]) { bearCrossLB[i] = true; break; }
    }
  }

  // ── Momentum acceleration / deceleration ──────────────────────────────────
  // Uses first-vs-last comparison over accelLookback bars (10% threshold)
  // gated by a minimum size filter (must be >20% of recent 20-bar histogram range).
  const histAccel: boolean[] = new Array(n).fill(false);
  const histDecel: boolean[] = new Array(n).fill(false);
  for (let i = P.accelLookback; i < n; i++) {
    const cur = hist[i];
    const prev = hist[i - P.accelLookback];
    if (isNaN(cur) || isNaN(prev)) continue;

    const curAbs = Math.abs(cur);
    const prevAbs = Math.abs(prev);

    // Size gate: ignore signals when histogram is near the zero-line
    let recentMax = 0;
    for (let k = Math.max(0, i - 19); k <= i; k++) {
      if (!isNaN(hist[k])) recentMax = Math.max(recentMax, Math.abs(hist[k]));
    }
    const meaningful = recentMax > 0 && curAbs > recentMax * 0.3;

    histAccel[i] = meaningful && curAbs > prevAbs * 1.2;
    histDecel[i] = meaningful && curAbs < prevAbs * 0.8;
  }

  // ── Confluence scoring ────────────────────────────────────────────────────
  const confirmedThreshold = Math.min(P.minScore + 2, 8);
  const rsiUpper = 50 + P.rsiStrength;
  const rsiLower = 50 - P.rsiStrength;

  const rawBullScore: number[] = new Array(n).fill(0);
  const rawBearScore: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const h = hist[i];
    const r = rsiArr[i];
    const e200 = ema200Arr[i];
    const adx = adxArr[i];
    const vRatio = volMA[i] > 0 ? volumes[i] / volMA[i] : 0;

    if (isNaN(h) || isNaN(r) || isNaN(e200) || isNaN(adx)) continue;

    const priceAboveEMA = closes[i] > e200;
    const priceBelowEMA = closes[i] < e200;
    const trendStrong = adx >= P.adxThreshold;
    const volSurge = vRatio >= P.volSurge;
    const aboveAvgVol = vRatio >= 1.0;

    const htf = htfLookup ? htfLookup(bars[i].time) : null;
    const htfBull = htf ? htf.close > htf.emaValue : false;
    const htfBear = htf ? htf.close < htf.emaValue : false;
    const hasHTF = htfLookup !== null;

    const bullDiv = rsiBullDiv[i] || macdBullDiv[i];
    const bearDiv = rsiBearDiv[i] || macdBearDiv[i];

    let bull = 0;
    bull += bullCrossLB[i] ? 1 : 0;
    bull += r > rsiUpper ? 1 : 0;
    bull += volSurge ? 2 : aboveAvgVol ? 1 : 0;
    bull += priceAboveEMA ? 1 : 0;
    bull += hasHTF && htfBull ? 1 : 0;
    bull += trendStrong ? 1 : 0;
    bull += bullDiv ? 1 : 0;
    rawBullScore[i] = Math.min(bull, 8);

    let bear = 0;
    bear += bearCrossLB[i] ? 1 : 0;
    bear += r < rsiLower ? 1 : 0;
    bear += volSurge ? 2 : aboveAvgVol ? 1 : 0;
    bear += priceBelowEMA ? 1 : 0;
    bear += hasHTF && htfBear ? 1 : 0;
    bear += trendStrong ? 1 : 0;
    bear += bearDiv ? 1 : 0;
    rawBearScore[i] = Math.min(bear, 8);
  }

  // ── Raw signal classification ──────────────────────────────────────────────
  const rawConfirmedBuy: boolean[] = new Array(n).fill(false);
  const rawStandardBuy: boolean[] = new Array(n).fill(false);
  const rawConfirmedSell: boolean[] = new Array(n).fill(false);
  const rawStandardSell: boolean[] = new Array(n).fill(false);

  for (let i = 0; i < n; i++) {
    const h = hist[i];
    if (isNaN(h)) continue;
    const strong = Math.abs(h) >= P.minHistStrength;
    rawConfirmedBuy[i] = h > 0 && strong && rawBullScore[i] >= confirmedThreshold;
    rawStandardBuy[i] = h > 0 && strong && rawBullScore[i] >= P.minScore && rawBullScore[i] < confirmedThreshold;
    rawConfirmedSell[i] = h < 0 && strong && rawBearScore[i] >= confirmedThreshold;
    rawStandardSell[i] = h < 0 && strong && rawBearScore[i] >= P.minScore && rawBearScore[i] < confirmedThreshold;
  }

  // ── Confirmation window ────────────────────────────────────────────────────
  const confBuy = applyConfirmation(rawConfirmedBuy, n);
  const confSell = applyConfirmation(rawConfirmedSell, n);
  const stdBuy = applyConfirmation(rawStandardBuy, n);
  const stdSell = applyConfirmation(rawStandardSell, n);

  // ── Cooldown ───────────────────────────────────────────────────────────────
  const finalConfirmedBuy: boolean[] = new Array(n).fill(false);
  const finalConfirmedSell: boolean[] = new Array(n).fill(false);
  const finalStdBuy: boolean[] = new Array(n).fill(false);
  const finalStdSell: boolean[] = new Array(n).fill(false);

  let lastBuyBar = -999;
  let lastSellBar = -999;
  for (let i = 0; i < n; i++) {
    const buyReady = i - lastBuyBar >= P.cooldown;
    const sellReady = i - lastSellBar >= P.cooldown;

    finalConfirmedBuy[i] = confBuy[i] && buyReady;
    finalStdBuy[i] = stdBuy[i] && buyReady && !finalConfirmedBuy[i];
    finalConfirmedSell[i] = confSell[i] && sellReady;
    finalStdSell[i] = stdSell[i] && sellReady && !finalConfirmedSell[i];

    if (finalConfirmedBuy[i] || finalStdBuy[i]) lastBuyBar = i;
    if (finalConfirmedSell[i] || finalStdSell[i]) lastSellBar = i;
  }

  // ── Counter-trend signals & momentum warnings ─────────────────────────────
  const counterRally: boolean[] = new Array(n).fill(false);
  const counterPullback: boolean[] = new Array(n).fill(false);
  const pullbackWarn: boolean[] = new Array(n).fill(false);
  const rallyWarn: boolean[] = new Array(n).fill(false);

  for (let i = 0; i < n; i++) {
    const h = hist[i];
    const e200 = ema200Arr[i];
    if (isNaN(h) || isNaN(e200)) continue;
    const aboveEMA = closes[i] > e200;
    const belowEMA = closes[i] < e200;
    const strong = Math.abs(h) >= P.minHistStrength;

    counterRally[i] = h > 0 && strong && rawBullScore[i] >= P.minScore && belowEMA;
    counterPullback[i] = h < 0 && strong && rawBearScore[i] >= P.minScore && aboveEMA;
    pullbackWarn[i] = histDecel[i] && h < 0 && aboveEMA;
    rallyWarn[i] = histDecel[i] && h > 0 && belowEMA;
  }

  return {
    rawBullScore,
    rawBearScore,
    finalConfirmedBuy,
    finalConfirmedSell,
    finalStdBuy,
    finalStdSell,
    counterRally,
    counterPullback,
    pullbackWarn,
    rallyWarn,
    histAccel,
    histDecel,
  };
}
