import { useState } from "react";
import type { ScaleName, TrackConfig } from "../api/types";
import { ROOT_NOTES } from "./SonifyControls";

interface TickerInputProps {
  tickers: string[];
  onChange: (tickers: string[]) => void;
  onColorChange: (ticker: string, color: string) => void;
  colorForTrack: (ticker: string, trackIndex: number) => string;
  trackConfigs: Record<string, TrackConfig>;
  onTrackConfigChange: (ticker: string, config: TrackConfig) => void;
}

const INSTRUMENTS = [
  { value: "", label: "Auto (Default)" },
  { value: "piano", label: "Piano" },
  { value: "synth_triangle", label: "Synth Triangle" },
  { value: "synth_sine", label: "Synth Sine" },
  { value: "synth_sawtooth", label: "Synth Sawtooth" },
];

const SCALES = [
  { value: "", label: "Global Default" },
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
  { value: "pentatonic_major", label: "Pentatonic Major" },
  { value: "pentatonic_minor", label: "Pentatonic Minor" },
  { value: "chromatic", label: "Chromatic" },
];

export function TickerInput({ tickers, onChange, colorForTrack, onColorChange, trackConfigs, onTrackConfigChange }: TickerInputProps) {
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
              <div className="track-config-panel">
                <div className="track-config-field">
                  <label>Instrument</label>
                  <select 
                    value={trackConfigs[t]?.instrument || ""} 
                    onChange={(e) => updateConfig(t, { instrument: e.target.value || undefined })}
                  >
                    {INSTRUMENTS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="track-config-field">
                  <label>Scale</label>
                  <select 
                    value={trackConfigs[t]?.scale || ""} 
                    onChange={(e) => updateConfig(t, { scale: (e.target.value as ScaleName) || undefined })}
                  >
                    {SCALES.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="track-config-field">
                  <label>Key</label>
                  <select 
                    value={trackConfigs[t]?.rootNote ?? ""} 
                    onChange={(e) => {
                      const val = e.target.value;
                      updateConfig(t, { rootNote: val ? parseInt(val, 10) : undefined });
                    }}
                  >
                    <option value="">Global Default</option>
                    {ROOT_NOTES.map((note, idx) => (
                      <option key={idx} value={idx}>{note}</option>
                    ))}
                  </select>
                </div>
                <div className="track-config-field">
                  <label>Tempo</label>
                  <select 
                    value={trackConfigs[t]?.notesPerBar || ""} 
                    onChange={(e) => {
                      const val = e.target.value;
                      updateConfig(t, { notesPerBar: val ? (parseInt(val, 10) as 1 | 2) : undefined });
                    }}
                  >
                    <option value="">Global Default</option>
                    <option value="1">1 Note / Bar</option>
                    <option value="2">2 Notes / Bar</option>
                  </select>
                </div>
              </div>
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
