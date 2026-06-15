import { useState } from "react";
import { useChartData } from "../api/queries";
import type { NoteEvent, TrackConfig, TrackMixerSettings } from "../api/types";
import { CandlestickChart } from "./CandlestickChart";
import { TrackConfigPanel } from "./TrackConfigPanel";

interface TickerChartPanelProps {
  ticker: string;
  start: string;
  end: string;
  color: string;
  notes: NoteEvent[];
  notesPerBar: 1 | 2;
  currentTime: number;
  muted: boolean;
  solo: boolean;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onSeek: (time: number) => void;
  trackConfig: TrackConfig;
  onTrackConfigChange: (config: TrackConfig) => void;
  trackMixer: TrackMixerSettings;
  onTrackMixerChange: (settings: Partial<TrackMixerSettings>) => void;
  independent: boolean;
  onToggleIndependent: () => void;
}

export function TickerChartPanel({
  ticker,
  start,
  end,
  color,
  notes,
  notesPerBar,
  currentTime,
  muted,
  solo,
  onToggleMute,
  onToggleSolo,
  onSeek,
  trackConfig,
  onTrackConfigChange,
  trackMixer,
  onTrackMixerChange,
  independent,
  onToggleIndependent,
}: TickerChartPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // Chord/harmony modes emit extra notes sharing the same time_sec as their melodic
  // note, which would throw off a plain `i * notesPerBar` index into `notes`.
  // Dedupe to the unique slot times first so the mapping stays 1 (or 2) per bar.
  const uniqueTimes = Array.from(new Set(notes.map((n) => n.time_sec))).sort((a, b) => a - b);

  const noteTimes = data.bars.map((_, i) => {
    if (uniqueTimes.length === 0) return 0;
    const idx = Math.min(i * notesPerBar, uniqueTimes.length - 1);
    return uniqueTimes[idx];
  });

  return (
    <div className="chart-panel">
      <CandlestickChart
        ticker={ticker}
        bars={data.bars}
        noteTimes={noteTimes}
        currentTime={currentTime}
        color={color}
        muted={muted}
        solo={solo}
        onToggleMute={onToggleMute}
        onToggleSolo={onToggleSolo}
        onSeek={onSeek}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((prev) => !prev)}
        independent={independent}
        onToggleIndependent={onToggleIndependent}
      />
      {settingsOpen && (
        <TrackConfigPanel
          config={trackConfig}
          mixer={trackMixer}
          onConfigChange={(partial) => onTrackConfigChange({ ...trackConfig, ...partial })}
          onMixerChange={onTrackMixerChange}
        />
      )}
    </div>
  );
}
