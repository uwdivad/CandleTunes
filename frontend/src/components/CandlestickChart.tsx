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
  muted: boolean;
  solo: boolean;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onSeek: (time: number) => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  independent: boolean;
  onToggleIndependent: () => void;
  locked: boolean;
  onToggleLock: () => void;
}

export function CandlestickChart({
  ticker,
  bars,
  noteTimes,
  currentTime,
  color,
  muted,
  solo,
  onToggleMute,
  onToggleSolo,
  onSeek,
  settingsOpen,
  onToggleSettings,
  independent,
  onToggleIndependent,
  locked,
  onToggleLock,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

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

    // CSS grid layout changes (e.g. adding/removing a ticker reflows every chart's
    // column width) don't fire a window resize event, so observe the container too.
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
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

  const seekToClientX = (clientX: number) => {
    if (!chartRef.current || !containerRef.current || bars.length === 0 || noteTimes.length === 0) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const logical = chartRef.current.timeScale().coordinateToLogical(x);
    if (logical === null) return;

    const clamped = Math.max(0, Math.min(bars.length - 1, logical));
    const i = Math.floor(clamped);
    const frac = clamped - i;
    const j = Math.min(i + 1, bars.length - 1);

    const t0 = noteTimes[i];
    const t1 = noteTimes[j] ?? t0;
    onSeek(Math.max(0, t0 + (t1 - t0) * frac));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekToClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    seekToClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="candlestick-chart">
      <div className="candlestick-chart-header">
        <span className="ticker-label" style={{ borderColor: color, color }}>
          {ticker}
        </span>
        <div className="track-mixer-buttons">
          <button
            type="button"
            className={`track-mixer-btn track-mute-btn ${muted ? "active" : ""}`}
            onClick={onToggleMute}
            aria-pressed={muted}
            title="Mute this track"
          >
            M
          </button>
          <button
            type="button"
            className={`track-mixer-btn track-solo-btn ${solo ? "active" : ""}`}
            onClick={onToggleSolo}
            aria-pressed={solo}
            title="Solo this track"
          >
            S
          </button>
          <button
            type="button"
            className={`track-mixer-btn track-settings-btn ${settingsOpen ? "active" : ""}`}
            onClick={onToggleSettings}
            aria-pressed={settingsOpen}
            title="Track settings"
          >
            ⚙️
          </button>
          <button
            type="button"
            className={`track-mixer-btn track-independent-btn ${independent ? "active" : ""}`}
            onClick={onToggleIndependent}
            aria-pressed={independent}
            title={independent ? "Independent timeline (click to re-sync with other tracks)" : "Give this chart its own playback timeline"}
          >
            {independent ? "🔓" : "🔗"}
          </button>
          <button
            type="button"
            className={`track-mixer-btn track-lock-btn ${locked ? "active" : ""}`}
            onClick={onToggleLock}
            aria-pressed={locked}
            title={
              locked
                ? "Settings locked — global changes skip this chart (click to unlock)"
                : "Lock this chart's settings against global changes"
            }
          >
            {locked ? "🔒" : "🔓"}
          </button>
        </div>
      </div>
      <div
        className="candlestick-chart-container"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div ref={containerRef} />
        <div ref={playheadRef} className="playhead-line" style={{ borderColor: color, boxShadow: `0 0 12px ${color}` }} />
      </div>
    </div>
  );
}
