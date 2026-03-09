/**
 * ATR Trailing Stop — stateful, direction-aware.
 * Mirrors the Pine Script var-based trailStop / trailBullish accumulation.
 */

import type { OHLCVBar } from "@/types";
import { P } from "./constants";

export function computeATRStop(
  bars: OHLCVBar[],
  closes: number[],
  atrArr: number[],
  finalConfirmedBuy: boolean[],
  finalStdBuy: boolean[],
  finalConfirmedSell: boolean[],
  finalStdSell: boolean[],
  showATRStop: boolean
): { time: number; value: number; color: string }[] {
  const out: { time: number; value: number; color: string }[] = [];
  let trailStop = NaN;
  let trailBullish = false;

  for (let i = 0; i < bars.length; i++) {
    if (!showATRStop || isNaN(atrArr[i])) continue;
    const atrBand = atrArr[i] * P.atrMult;

    if (finalConfirmedBuy[i] || finalStdBuy[i]) {
      trailStop = bars[i].low - atrBand;
      trailBullish = true;
    } else if (finalConfirmedSell[i] || finalStdSell[i]) {
      trailStop = bars[i].high + atrBand;
      trailBullish = false;
    } else if (!isNaN(trailStop)) {
      if (trailBullish) {
        trailStop = Math.max(trailStop, closes[i] - atrBand);
      } else {
        trailStop = Math.min(trailStop, closes[i] + atrBand);
      }
    }

    if (!isNaN(trailStop)) {
      out.push({
        time: bars[i].time,
        value: trailStop,
        color: closes[i] > trailStop ? "#00E676" : "#FF1744",
      });
    }
  }

  return out;
}
