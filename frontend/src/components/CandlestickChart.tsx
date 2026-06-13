import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

import type { OHLCVBar } from "../api/types";

interface CandlestickChartProps {
  ticker: string;
  bars: OHLCVBar[];
  /** time_sec (playback time) corresponding to each bar, same length as bars */
  noteTimes: number[];
  currentTime: number;
  color: string;
}

export function CandlestickChart({ ticker, bars, noteTimes, currentTime, color }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 220,
      layout: { background: { color: "transparent" }, textColor: "#ccc" },
      grid: {
        vertLines: { color: "#2a2a2a" },
        horzLines: { color: "#2a2a2a" },
      },
      timeScale: { borderColor: "#444" },
      rightPriceScale: { borderColor: "#444" },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    const data = bars.map((bar) => ({
      time: bar.date as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [bars]);

  useEffect(() => {
    if (!chartRef.current || !playheadRef.current || bars.length === 0 || noteTimes.length === 0) {
      return;
    }

    let i = 0;
    while (i < noteTimes.length - 1 && noteTimes[i + 1] <= currentTime) {
      i++;
    }
    const j = Math.min(i + 1, bars.length - 1);

    const timeScale = chartRef.current.timeScale();
    const xi = timeScale.timeToCoordinate(bars[i].date as Time);
    const xj = timeScale.timeToCoordinate(bars[j].date as Time);

    if (xi === null || xj === null) {
      playheadRef.current.style.display = "none";
      return;
    }

    const t0 = noteTimes[i];
    const t1 = noteTimes[j] ?? t0;
    const frac = t1 > t0 ? (currentTime - t0) / (t1 - t0) : 0;
    const x = xi + (xj - xi) * Math.max(0, Math.min(1, frac));

    playheadRef.current.style.display = "block";
    playheadRef.current.style.left = `${x}px`;
  }, [currentTime, bars, noteTimes]);

  return (
    <div className="candlestick-chart">
      <div className="candlestick-chart-header">
        <span className="ticker-label" style={{ borderColor: color, color }}>
          {ticker}
        </span>
      </div>
      <div className="candlestick-chart-container">
        <div ref={containerRef} />
        <div ref={playheadRef} className="playhead-line" style={{ borderColor: color }} />
      </div>
    </div>
  );
}
