"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type UTCTimestamp,
  type SeriesMarkerBarPosition,
  type SeriesMarkerShape,
  type IRange,
  type Time,
} from "lightweight-charts";
import type { OHLCVBar, CrosshairBar, ChartMarker } from "@/types";

const CHART_OPTIONS = {
  layout: {
    background: { color: "#131722" },
    textColor: "#787b86",
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif",
    fontSize: 12,
  },
  grid: {
    vertLines: { color: "#1c2030" },
    horzLines: { color: "#1c2030" },
  },
  crosshair: {
    vertLine: { color: "#4c525e", labelBackgroundColor: "#2a2e39", width: 1 as const },
    horzLine: { color: "#4c525e", labelBackgroundColor: "#2a2e39" },
  },
  rightPriceScale: { borderColor: "#2a2e39", textColor: "#787b86" },
  timeScale: {
    borderColor: "#2a2e39",
    textColor: "#787b86",
    timeVisible: true,
    secondsVisible: false,
  },
} as const;

// How many bars from the left edge triggers a back-fill
const LEFT_EDGE_THRESHOLD = 10;

export function useLightweightChart(
  containerRef: React.RefObject<HTMLDivElement | null>,
  onCrosshairMove?: (bar: CrosshairBar | null) => void,
  onReachLeftEdge?: () => void
) {
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const atrSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<any> | null>(null);

  const crosshairCbRef = useRef(onCrosshairMove);
  crosshairCbRef.current = onCrosshairMove;

  const leftEdgeCbRef = useRef(onReachLeftEdge);
  leftEdgeCbRef.current = onReachLeftEdge;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      ...CHART_OPTIONS,
      width: el.clientWidth,
      height: el.clientHeight,
    });

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    // EMA 200 — orange line
    // autoscaleInfoProvider: () => null excludes this series from price-scale
    // auto-fit so toggling it never causes the chart to jump/resize.
    const emaSeries = chart.addSeries(LineSeries, {
      color: "#F57F17",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => null,
    });

    // ATR Trailing Stop — solid per-point colored line
    const atrSeries = chart.addSeries(LineSeries, {
      color: "#00E676",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => null,
    });

    // Markers plugin (v5 API)
    const markersPlugin = createSeriesMarkers(candleSeries, []);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    emaSeriesRef.current = emaSeries;
    atrSeriesRef.current = atrSeries;
    markersPluginRef.current = markersPlugin;

    // Crosshair subscription
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !candleSeriesRef.current) {
        crosshairCbRef.current?.(null);
        return;
      }
      const raw = param.seriesData.get(candleSeriesRef.current);
      if (raw && "open" in raw) {
        crosshairCbRef.current?.({
          time: param.time as number,
          open: (raw as { open: number }).open,
          high: (raw as { high: number }).high,
          low: (raw as { low: number }).low,
          close: (raw as { close: number }).close,
        });
      }
    });

    // Left-edge detection — fire when user scrolls near the first bar
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range) return;
      if (range.from <= LEFT_EDGE_THRESHOLD) {
        leftEdgeCbRef.current?.();
      }
    });

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      emaSeriesRef.current = null;
      atrSeriesRef.current = null;
      markersPluginRef.current = null;
    };
  }, [containerRef]);

  /**
   * Set candle data.
   * @param preserveView  When true (back-fill), the visible time range is saved and
   *                      restored after setData so the viewport doesn't jump.
   *                      When false (initial load), fitContent() is called instead.
   */
  const setCandles = useCallback((bars: OHLCVBar[], preserveView = false) => {
    if (!candleSeriesRef.current || !chartRef.current) return;
    const chart = chartRef.current;

    const savedRange: IRange<Time> | null = preserveView
      ? chart.timeScale().getVisibleRange()
      : null;

    candleSeriesRef.current.setData(
      bars.map((b) => ({
        time: b.time as UTCTimestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }))
    );

    if (preserveView && savedRange) {
      chart.timeScale().setVisibleRange(savedRange);
    } else {
      chart.priceScale("right").applyOptions({ autoScale: true });
      chart.timeScale().fitContent();
    }
  }, []);

  const setEMA = useCallback((points: { time: number; value: number }[]) => {
    if (!emaSeriesRef.current) return;
    emaSeriesRef.current.setData(
      points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))
    );
  }, []);

  const setATRStop = useCallback(
    (points: { time: number; value: number; color: string }[]) => {
      if (!atrSeriesRef.current) return;
      atrSeriesRef.current.setData(
        points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value, color: p.color }))
      );
    },
    []
  );

  const setMarkers = useCallback((markers: ChartMarker[]) => {
    if (!markersPluginRef.current) return;
    markersPluginRef.current.setMarkers(
      markers.map((m) => ({
        time: m.time as UTCTimestamp,
        position: m.position as SeriesMarkerBarPosition,
        shape: m.shape as SeriesMarkerShape,
        color: m.color,
        text: m.text ?? "",
        size: m.size ?? 1,
      }))
    );
  }, []);

  return { setCandles, setEMA, setATRStop, setMarkers };
}
