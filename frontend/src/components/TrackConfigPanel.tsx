import { DEFAULT_TRACK_MIXER, type ChordMode, type ScaleName, type TrackConfig, type TrackMixerSettings } from "../api/types";
import { CHORD_MODES, INSTRUMENTS, OCTAVES, ROOT_NOTES, SCALES } from "./trackOptions";

interface TrackConfigPanelProps {
  config: TrackConfig;
  mixer: TrackMixerSettings;
  onConfigChange: (partial: Partial<TrackConfig>) => void;
  onMixerChange: (partial: Partial<TrackMixerSettings>) => void;
}

export function TrackConfigPanel({ config, mixer, onConfigChange, onMixerChange }: TrackConfigPanelProps) {
  return (
    <div className="track-config-panel">
      <div className="track-config-field">
        <label>Instrument</label>
        <select
          value={config.instrument || ""}
          onChange={(e) => onConfigChange({ instrument: e.target.value || undefined })}
        >
          {INSTRUMENTS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="track-config-field">
        <label>Scale</label>
        <select
          value={config.scale || ""}
          onChange={(e) => onConfigChange({ scale: (e.target.value as ScaleName) || undefined })}
        >
          {SCALES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="track-config-field">
        <label>Key</label>
        <select
          value={config.rootNote ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            onConfigChange({ rootNote: val ? parseInt(val, 10) : undefined });
          }}
        >
          <option value="">Global Default</option>
          {ROOT_NOTES.map((note, idx) => (
            <option key={idx} value={idx}>{note}</option>
          ))}
        </select>
      </div>
      <div className="track-config-field">
        <label>Octave</label>
        <select
          value={config.registerBaseMidi ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            onConfigChange({ registerBaseMidi: val ? parseInt(val, 10) : undefined });
          }}
        >
          {OCTAVES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="track-config-field">
        <label>Tempo</label>
        <select
          value={config.notesPerBar || ""}
          onChange={(e) => {
            const val = e.target.value;
            onConfigChange({ notesPerBar: val ? (parseInt(val, 10) as 1 | 2) : undefined });
          }}
        >
          <option value="">Global Default</option>
          <option value="1">1 Note / Bar</option>
          <option value="2">2 Notes / Bar</option>
        </select>
      </div>
      <div className="track-config-field">
        <label>Harmony</label>
        <select
          value={config.chordMode || ""}
          onChange={(e) => {
            const val = e.target.value;
            onConfigChange({ chordMode: (val as ChordMode) || undefined });
          }}
        >
          <option value="">Global Default</option>
          {CHORD_MODES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="track-config-field">
        <label>Volume ({mixer.volume ?? DEFAULT_TRACK_MIXER.volume}%)</label>
        <input
          type="range"
          min={0}
          max={100}
          value={mixer.volume ?? DEFAULT_TRACK_MIXER.volume}
          onChange={(e) => onMixerChange({ volume: parseInt(e.target.value, 10) })}
        />
      </div>
      <div className="track-config-field">
        <label>Pan ({(mixer.pan ?? DEFAULT_TRACK_MIXER.pan).toFixed(2)})</label>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.05}
          value={mixer.pan ?? DEFAULT_TRACK_MIXER.pan}
          onChange={(e) => onMixerChange({ pan: parseFloat(e.target.value) })}
        />
      </div>
    </div>
  );
}
