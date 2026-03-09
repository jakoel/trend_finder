# TrendFinder

A TradingView-style charting terminal for long-term stock analysis, built with Next.js and lightweight-charts.

![Next.js](https://img.shields.io/badge/Next.js-15-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![lightweight-charts](https://img.shields.io/badge/lightweight--charts-5-orange)

## Features

- **Candlestick chart** with EMA 200 overlay and ATR trailing stop line
- **Indicator engine** — MACD/RSI confluence scoring, divergence detection, counter-trend signals
- **Symbol search** — 25 curated large-cap stocks with fuzzy search
- **Timeframes** — 1D / 1W / 1M
- **Infinite scroll back-fill** — scrolling left fetches older history automatically
- **IndexedDB caching** (Dexie) — bars and indicator output cached locally to minimise API calls
- **No API key required** — proxies Yahoo Finance server-side to avoid CORS

## Indicator Toggles

| Button | What it shows on the chart |
|--------|---------------------------|
| **Signals** | `CR` / `CP` counter-trend circles + `X` RSI extreme markers |
| **ATR Stop** | ATR trailing stop line (green = bullish, red = bearish) |
| **Div** | Bullish / bearish divergence arrows (RSI & MACD histogram) |
| **Mom** | MACD histogram deceleration arrows (momentum fading) |
| **ADX** | Silent scoring gate — filters signals in choppy markets (no visual) |

## Stack

| Layer | Library |
|-------|---------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Charting | lightweight-charts v5 |
| Styling | Tailwind CSS v4 |
| Local DB | Dexie v4 (IndexedDB) |
| Icons | lucide-react |
| Data | Yahoo Finance (via `/api/chart` proxy route) |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/
  api/chart/route.ts     Yahoo Finance proxy (server-side)
  layout.tsx / page.tsx  Root layout and entry point
components/
  TradingTerminal.tsx    Root state: symbol, timeframe, settings, stats bar
  navbar/                TopNav, TickerSearch, TimeframeSelector, IndicatorToggles
  chart/TradingChart.tsx Data pipeline, back-fill logic, chart wiring
hooks/
  useLightweightChart.ts Chart lifecycle, ResizeObserver, crosshair, series setters
lib/
  api.ts                 fetchOHLCV, fetchOHLCVBefore, searchTickers
  db.ts                  Dexie schema — bars, historical bars, indicator output cache
  indicator-engine.ts    Orchestrator → IndicatorOutput
  math/indicators.ts     EMA, SMA, RSI, MACD, ATR, DMI primitives
  math/pivots.ts         Pivot high/low detection, HTF EMA lookup
  engine/constants.ts    All tunable parameters (P) and colors (C)
  engine/signals.ts      MACD crossover scoring → buy/sell/counter signals
  engine/divergence.ts   RSI & MACD histogram divergence scan
  engine/atr-stop.ts     ATR trailing stop computation
types/index.ts           Shared TypeScript types
```

## Notes

- Data is fetched fresh on first load and cached for 5 minutes. Older historical bars are stored permanently in IndexedDB and merged with fresh data on subsequent loads.
- The indicator engine runs entirely client-side — no backend computation.
- Designed for long-term analysis (daily and above), not real-time intraday trading.
