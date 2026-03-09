/**
 * RSI and MACD histogram divergence detection.
 * Stateful scan over the full bar array — mirrors Pine Script's var-based accumulation.
 */

export interface DivergenceInput {
  n: number;
  pivHPrice: (number | null)[];
  pivLPrice: (number | null)[];
  pivHRSI: (number | null)[];
  pivLRSI: (number | null)[];
  pivHHist: (number | null)[];
  pivLHist: (number | null)[];
  highs: number[];
  lows: number[];
}

export interface DivergenceOutput {
  rsiBullDiv: boolean[];
  rsiBearDiv: boolean[];
  macdBullDiv: boolean[];
  macdBearDiv: boolean[];
}

export function scanDivergence(input: DivergenceInput): DivergenceOutput {
  const { n, pivHPrice, pivLPrice, pivHRSI, pivLRSI, pivHHist, pivLHist, highs, lows } = input;

  const rsiBullDiv: boolean[] = new Array(n).fill(false);
  const rsiBearDiv: boolean[] = new Array(n).fill(false);
  const macdBullDiv: boolean[] = new Array(n).fill(false);
  const macdBearDiv: boolean[] = new Array(n).fill(false);

  let prevPivHPrice: number | null = null;
  let prevPivLPrice: number | null = null;
  let prevPivHRSI: number | null = null;
  let prevPivLRSI: number | null = null;
  let prevHistPivH: number | null = null;
  let prevHistPivL: number | null = null;
  let prevHistPivHPrice: number | null = null;
  let prevHistPivLPrice: number | null = null;

  for (let i = 0; i < n; i++) {
    // RSI bearish divergence: price higher high, RSI lower high
    if (pivHPrice[i] !== null) {
      if (prevPivHPrice !== null && prevPivHRSI !== null && pivHRSI[i] !== null) {
        if (pivHPrice[i]! > prevPivHPrice && pivHRSI[i]! < prevPivHRSI) {
          rsiBearDiv[i] = true;
        }
      }
      prevPivHPrice = pivHPrice[i];
      prevPivHRSI = pivHRSI[i];
    }

    // RSI bullish divergence: price lower low, RSI higher low
    if (pivLPrice[i] !== null) {
      if (prevPivLPrice !== null && prevPivLRSI !== null && pivLRSI[i] !== null) {
        if (pivLPrice[i]! < prevPivLPrice && pivLRSI[i]! > prevPivLRSI) {
          rsiBullDiv[i] = true;
        }
      }
      prevPivLPrice = pivLPrice[i];
      prevPivLRSI = pivLRSI[i];
    }

    // MACD histogram bearish divergence: price higher high, histogram lower high
    if (pivHHist[i] !== null) {
      const priceAtPivot = highs[i];
      if (prevHistPivH !== null && prevHistPivHPrice !== null) {
        if (priceAtPivot > prevHistPivHPrice && pivHHist[i]! < prevHistPivH) {
          macdBearDiv[i] = true;
        }
      }
      prevHistPivH = pivHHist[i];
      prevHistPivHPrice = priceAtPivot;
    }

    // MACD histogram bullish divergence: price lower low, histogram higher low
    if (pivLHist[i] !== null) {
      const priceAtPivot = lows[i];
      if (prevHistPivL !== null && prevHistPivLPrice !== null) {
        if (priceAtPivot < prevHistPivLPrice && pivLHist[i]! > prevHistPivL) {
          macdBullDiv[i] = true;
        }
      }
      prevHistPivL = pivLHist[i];
      prevHistPivLPrice = priceAtPivot;
    }
  }

  return { rsiBullDiv, rsiBearDiv, macdBullDiv, macdBearDiv };
}
