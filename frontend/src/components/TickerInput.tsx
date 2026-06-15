import { useState } from "react";
import { DEFAULT_TRACK_MIXER, type TrackConfig, type TrackMixerSettings } from "../api/types";
import { TrackConfigPanel } from "./TrackConfigPanel";

interface TickerInputProps {
  tickers: string[];
  onChange: (tickers: string[]) => void;
  onColorChange: (ticker: string, color: string) => void;
  colorForTrack: (ticker: string, trackIndex: number) => string;
  trackConfigs: Record<string, TrackConfig>;
  onTrackConfigChange: (ticker: string, config: TrackConfig) => void;
  trackMixer: Record<string, TrackMixerSettings>;
  onTrackMixerChange: (ticker: string, settings: Partial<TrackMixerSettings>) => void;
}

export function TickerInput({ tickers, onChange, colorForTrack, onColorChange, trackConfigs, onTrackConfigChange, trackMixer, onTrackMixerChange }: TickerInputProps) {
  const [value, setValue] = useState("");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  const addTicker = () => {
    const parts = value
      .split(/[\s,]+/)
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length > 0);

    if (parts.length === 0) return;

    const next = [...tickers];
    for (const t of parts) {
      if (!next.includes(t)) next.push(t);
    }
    onChange(next);
    setValue("");
  };

  const removeTicker = (t: string) => {
    if (expandedTicker === t) setExpandedTicker(null);
    onChange(tickers.filter((x) => x !== t));
  };

  const removeAllTickers = () => {
    setExpandedTicker(null);
    onChange([]);
  };

  const updateConfig = (ticker: string, partial: Partial<TrackConfig>) => {
    const current = trackConfigs[ticker] || {};
    onTrackConfigChange(ticker, { ...current, ...partial });
  };

  return (
    <div className="field-group ticker-input">
      <label className="field-label">Tickers</label>
      <div className="ticker-chips">
        {tickers.map((t, i) => (
          <div key={t} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="ticker-chip" style={{ borderColor: colorForTrack(t, i), display: "inline-flex", flex: 1, alignItems: "center" }}>
                <label className="ticker-chip-swatch" style={{ background: colorForTrack(t, i), cursor: "pointer" }}>
                  <input
                    type="color"
                    value={colorForTrack(t, i)}
                    onChange={(e) => onColorChange(t, e.target.value)}
                    style={{ opacity: 0, width: 0, height: 0, padding: 0, border: "none", position: "absolute" }}
                  />
                </label>
                <span style={{ flex: 1 }}>{t}</span>
                <button 
                  type="button" 
                  onClick={() => setExpandedTicker(expandedTicker === t ? null : t)} 
                  aria-label={`Settings for ${t}`}
                  style={{ marginLeft: "4px", fontSize: "12px", opacity: expandedTicker === t ? 1 : 0.6 }}
                >
                  ⚙️
                </button>
                <button type="button" onClick={() => removeTicker(t)} aria-label={`Remove ${t}`}>
                  ×
                </button>
              </span>
            </div>

            {expandedTicker === t && (
              <TrackConfigPanel
                config={trackConfigs[t] || {}}
                mixer={trackMixer[t] || DEFAULT_TRACK_MIXER}
                onConfigChange={(partial) => updateConfig(t, partial)}
                onMixerChange={(partial) => onTrackMixerChange(t, partial)}
              />
            )}
          </div>
        ))}
        {tickers.length > 0 && (
          <button type="button" className="remove-all-btn" onClick={removeAllTickers}>
            Remove all
          </button>
        )}
      </div>
      <div className="ticker-input-row">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTicker();
            }
          }}
          placeholder="e.g. AAPL, BTC-USD, EURUSD=X"
        />
        <button type="button" onClick={addTicker}>
          Add
        </button>
      </div>
    </div>
  );
}
