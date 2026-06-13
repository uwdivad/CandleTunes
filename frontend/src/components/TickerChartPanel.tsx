import { useChartData } from "../api/queries";
import type { NoteEvent } from "../api/types";
import { CandlestickChart } from "./CandlestickChart";

interface TickerChartPanelProps {
  ticker: string;
  start: string;
  end: string;
  color: string;
  notes: NoteEvent[];
  notesPerBar: 1 | 2;
  currentTime: number;
}

export function TickerChartPanel({
  ticker,
  start,
  end,
  color,
  notes,
  notesPerBar,
  currentTime,
}: TickerChartPanelProps) {
  const { data, isLoading, isError, error } = useChartData(ticker, start, end);

  if (isLoading) {
    return <div className="chart-panel chart-panel-status">Loading {ticker}…</div>;
  }

  if (isError || !data) {
    return (
      <div className="chart-panel chart-panel-status error">
        Failed to load {ticker}: {(error as Error)?.message ?? "unknown error"}
      </div>
    );
  }

  const noteTimes = data.bars.map((_, i) => {
    if (notes.length === 0) return 0;
    const idx = Math.min(i * notesPerBar, notes.length - 1);
    return notes[idx].time_sec;
  });

  return (
    <div className="chart-panel">
      <CandlestickChart
        ticker={ticker}
        bars={data.bars}
        noteTimes={noteTimes}
        currentTime={currentTime}
        color={color}
      />
    </div>
  );
}
