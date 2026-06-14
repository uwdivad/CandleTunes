import type { ScaleName } from "../api/types";

const SCALES: { value: ScaleName; label: string }[] = [
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
  { value: "pentatonic_major", label: "Pentatonic Major" },
  { value: "pentatonic_minor", label: "Pentatonic Minor" },
  { value: "chromatic", label: "Chromatic" },
];

export const ROOT_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const INSTRUMENTS = [
  { value: "", label: "Auto (Default)" },
  { value: "piano", label: "Piano" },
  { value: "synth_triangle", label: "Synth Triangle" },
  { value: "synth_sine", label: "Synth Sine" },
  { value: "synth_sawtooth", label: "Synth Sawtooth" },
];

interface SonifyControlsProps {
  scale: ScaleName;
  rootNote: number;
  notesPerBar: 1 | 2;
  bpm: number;
  totalDuration: number;
  speedMode: 'bpm' | 'duration';
  globalInstrument: string;
  onScaleChange: (scale: ScaleName) => void;
  onRootNoteChange: (rootNote: number) => void;
  onNotesPerBarChange: (notesPerBar: 1 | 2) => void;
  onBpmChange: (bpm: number) => void;
  onTotalDurationChange: (duration: number) => void;
  onSpeedModeChange: (mode: 'bpm' | 'duration') => void;
  onGlobalInstrumentChange: (inst: string) => void;
}

export function SonifyControls({
  scale,
  rootNote,
  notesPerBar,
  bpm,
  totalDuration,
  speedMode,
  globalInstrument,
  onScaleChange,
  onRootNoteChange,
  onNotesPerBarChange,
  onBpmChange,
  onTotalDurationChange,
  onSpeedModeChange,
  onGlobalInstrumentChange,
}: SonifyControlsProps) {
  return (
    <div className="field-group sonify-controls">
      <label className="field-label">Sonification</label>
      <div className="sonify-controls-row">
        <label className="inline-field">
          Scale
          <select value={scale} onChange={(e) => onScaleChange(e.target.value as ScaleName)}>
            {SCALES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-field">
          Key
          <select value={rootNote} onChange={(e) => onRootNoteChange(Number(e.target.value))}>
            {ROOT_NOTES.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-field">
          Notes/bar
          <select
            value={notesPerBar}
            onChange={(e) => onNotesPerBarChange(Number(e.target.value) as 1 | 2)}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
      </div>

      <label className="inline-field" style={{ marginBottom: '8px' }}>
        Global Instrument
        <select value={globalInstrument} onChange={(e) => onGlobalInstrumentChange(e.target.value)}>
          {INSTRUMENTS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <div className="speed-mode-toggle" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button 
          type="button" 
          onClick={() => onSpeedModeChange('bpm')}
          style={{ flex: 1, borderColor: speedMode === 'bpm' ? 'var(--accent)' : 'var(--border)' }}
        >
          Target BPM
        </button>
        <button 
          type="button" 
          onClick={() => onSpeedModeChange('duration')}
          style={{ flex: 1, borderColor: speedMode === 'duration' ? 'var(--accent)' : 'var(--border)' }}
        >
          Target Duration
        </button>
      </div>

      {speedMode === 'bpm' ? (
        <label className="inline-field duration-field">
          Tempo: {bpm} BPM
          <input
            type="range"
            min={30}
            max={240}
            step={5}
            value={bpm}
            onChange={(e) => onBpmChange(Number(e.target.value))}
          />
        </label>
      ) : (
        <label className="inline-field duration-field">
          Duration: {totalDuration}s
          <input
            type="range"
            min={15}
            max={180}
            step={5}
            value={totalDuration}
            onChange={(e) => onTotalDurationChange(Number(e.target.value))}
          />
        </label>
      )}
    </div>
  );
}
