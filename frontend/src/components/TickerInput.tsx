import { useState } from "react";

interface TickerInputProps {
  tickers: string[];
  onChange: (tickers: string[]) => void;
  colorForTrack: (trackIndex: number) => string;
}

export function TickerInput({ tickers, onChange, colorForTrack }: TickerInputProps) {
  const [value, setValue] = useState("");

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
    onChange(tickers.filter((x) => x !== t));
  };

  return (
    <div className="field-group ticker-input">
      <label className="field-label">Tickers</label>
      <div className="ticker-chips">
        {tickers.map((t, i) => (
          <span key={t} className="ticker-chip" style={{ borderColor: colorForTrack(i) }}>
            <span className="ticker-chip-swatch" style={{ background: colorForTrack(i) }} />
            {t}
            <button type="button" onClick={() => removeTicker(t)} aria-label={`Remove ${t}`}>
              ×
            </button>
          </span>
        ))}
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
