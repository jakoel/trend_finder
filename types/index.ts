export type Timeframe = "1D" | "1W" | "1M";

export interface OHLCVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CachedBar extends OHLCVBar {
  symbol: string;
  timeframe: Timeframe;
  fetchedAt: number;
}

export interface IndicatorPoint {
  time: number;
  value: number;
  color?: string;
}

export interface Ticker {
  symbol: string;
  label: string;
  exchange: string;
}

export interface MarketMeta {
  symbol: string;
  shortName: string;
  exchange: string;
  currency: string;
  regularMarketPrice: number;
  previousClose: number;
}

export interface CrosshairBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// ── Indicator suite ─────────────────────────────────────────────────────────

export interface IndicatorSettings {
  showSignals: boolean;    // Buy/Sell markers
  showATRStop: boolean;    // ATR trailing stop line
  showDivergence: boolean; // Divergence markers
  showMomentum: boolean;   // Momentum fading markers
  useADXFilter: boolean;   // ADX choppiness gate (scoring only, no visual)
}

export interface ChartMarker {
  time: number;
  position: "aboveBar" | "belowBar";
  shape: "arrowUp" | "arrowDown" | "circle" | "square";
  color: string;
  text?: string;
  size?: number;
  category: "signal" | "divergence" | "momentum" | "rsiExtreme" | "volume";
}

export interface IndicatorStats {
  rsi: number;
  adx: number;
  histogram: number;
  histExpanding: boolean;
  bullScore: number;
  bearScore: number;
  signal: string;
  signalColor: string;
  warning: string;
  warningColor: string;
  trend: string;
  trendColor: string;
  momentum: string;
  momentumColor: string;
  volume: string;
  volumeColor: string;
  volumeRatio: number;
}

export interface IndicatorOutput {
  ema200: { time: number; value: number }[];
  atrStop: { time: number; value: number; color: string }[];
  markers: ChartMarker[];
  stats: IndicatorStats | null;
}
