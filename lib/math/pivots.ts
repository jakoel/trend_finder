/**
 * Pivot detection and HTF EMA lookup builder.
 */

import type { OHLCVBar } from "@/types";
import { ema } from "./indicators";

// Strict pivot: candidate must be strictly greater than all neighbors in window
export function pivotHigh(values: number[], left: number, right: number): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = left; i < n - right; i++) {
    if (isNaN(values[i])) continue;
    let ok = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (isNaN(values[j]) || values[j] >= values[i]) { ok = false; break; }
    }
    if (ok) out[i] = values[i];
  }
  return out;
}

export function pivotLow(values: number[], left: number, right: number): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = left; i < n - right; i++) {
    if (isNaN(values[i])) continue;
    let ok = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (isNaN(values[j]) || values[j] <= values[i]) { ok = false; break; }
    }
    if (ok) out[i] = values[i];
  }
  return out;
}

// For each main-chart bar time, binary-searches the HTF bar array and returns
// the most recent HTF bar's EMA value and close.
export function buildHTFLookup(htfBars: OHLCVBar[], emaLen: number) {
  if (!htfBars.length) return null;
  const htfCloses = htfBars.map((b) => b.close);
  const htfEMA = ema(htfCloses, emaLen);
  return (t: number): { emaValue: number; close: number } | null => {
    let lo = 0;
    let hi = htfBars.length - 1;
    if (htfBars[0].time > t) return null;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (htfBars[mid].time <= t) lo = mid;
      else hi = mid - 1;
    }
    return { emaValue: htfEMA[lo], close: htfBars[lo].close };
  };
}
