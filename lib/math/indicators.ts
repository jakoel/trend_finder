/**
 * Pure math primitives — EMA, RMA, SMA, RSI, MACD, ATR, DMI.
 * No business logic. No Pine Script concepts beyond the formulas themselves.
 */

import type { OHLCVBar } from "@/types";

export function ema(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  const alpha = 2 / (period + 1);

  let seed = 0;
  let count = 0;
  let startIdx = -1;
  for (let i = 0; i < values.length; i++) {
    if (isNaN(values[i])) continue;
    if (startIdx === -1) startIdx = i;
    seed += values[i];
    count++;
    if (count === period) {
      out[i] = seed / period;
      for (let j = i + 1; j < values.length; j++) {
        if (!isNaN(values[j])) out[j] = values[j] * alpha + out[j - 1] * (1 - alpha);
        else out[j] = out[j - 1];
      }
      break;
    }
  }
  return out;
}

// Wilder's RMA — alpha = 1/period
export function rma(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  const alpha = 1 / period;

  let sum = 0;
  let count = 0;
  let seeded = false;

  for (let i = 0; i < values.length; i++) {
    const v = isNaN(values[i]) ? 0 : values[i];
    if (!seeded) {
      sum += v;
      count++;
      if (count === period) {
        out[i] = sum / period;
        seeded = true;
      }
    } else {
      out[i] = v * alpha + out[i - 1] * (1 - alpha);
    }
  }
  return out;
}

export function sma(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += isNaN(values[j]) ? 0 : values[j];
    out[i] = s / period;
  }
  return out;
}

export function trueRange(bars: OHLCVBar[]): number[] {
  const out = new Array<number>(bars.length).fill(NaN);
  out[0] = bars[0].high - bars[0].low;
  for (let i = 1; i < bars.length; i++) {
    const hl = bars[i].high - bars[i].low;
    const hc = Math.abs(bars[i].high - bars[i - 1].close);
    const lc = Math.abs(bars[i].low - bars[i - 1].close);
    out[i] = Math.max(hl, hc, lc);
  }
  return out;
}

export function computeRSI(closes: number[], period: number): number[] {
  const n = closes.length;
  const gains = new Array<number>(n).fill(0);
  const losses = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    const d = closes[i] - closes[i - 1];
    gains[i] = Math.max(d, 0);
    losses[i] = Math.max(-d, 0);
  }
  const ag = rma(gains, period);
  const al = rma(losses, period);
  return ag.map((g, i) => {
    if (isNaN(g) || isNaN(al[i])) return NaN;
    if (al[i] === 0) return 100;
    return 100 - 100 / (1 + g / al[i]);
  });
}

export function computeMACD(closes: number[], fast: number, slow: number, signal: number) {
  const fastEMA = ema(closes, fast);
  const slowEMA = ema(closes, slow);
  const macdLine = fastEMA.map((f, i) => (isNaN(f) || isNaN(slowEMA[i]) ? NaN : f - slowEMA[i]));
  const signalLine = ema(macdLine, signal);
  const hist = macdLine.map((m, i) => (isNaN(m) || isNaN(signalLine[i]) ? NaN : m - signalLine[i]));
  return { macdLine, signalLine, hist };
}

export function computeATR(bars: OHLCVBar[], period: number): number[] {
  return rma(trueRange(bars), period);
}

export function computeDMI(bars: OHLCVBar[], period: number) {
  const n = bars.length;
  const plusDM = new Array<number>(n).fill(0);
  const minusDM = new Array<number>(n).fill(0);
  const tr = trueRange(bars);

  for (let i = 1; i < n; i++) {
    const up = bars[i].high - bars[i - 1].high;
    const dn = bars[i - 1].low - bars[i].low;
    if (up > dn && up > 0) plusDM[i] = up;
    if (dn > up && dn > 0) minusDM[i] = dn;
  }

  const sPlusDM = rma(plusDM, period);
  const sMinusDM = rma(minusDM, period);
  const sTR = rma(tr, period);

  const diPlus = new Array<number>(n).fill(NaN);
  const diMinus = new Array<number>(n).fill(NaN);
  const dx = new Array<number>(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    if (!isNaN(sTR[i]) && sTR[i] > 0) {
      diPlus[i] = (100 * sPlusDM[i]) / sTR[i];
      diMinus[i] = (100 * sMinusDM[i]) / sTR[i];
      const sum = diPlus[i] + diMinus[i];
      if (sum > 0) dx[i] = (100 * Math.abs(diPlus[i] - diMinus[i])) / sum;
    }
  }

  return { diPlus, diMinus, adx: rma(dx, period) };
}
