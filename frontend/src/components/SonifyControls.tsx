import type { ScaleName } from "../api/types";

const SCALES: { value: ScaleName; label: string }[] = [
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
  { value: "pentatonic_major", label: "Pentatonic Major" },
  { value: "pentatonic_minor", label: "Pentatonic Minor" },
  { value: "chromatic", label: "Chromatic" },
];

const ROOT_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

interface SonifyControlsProps {
  scale: ScaleName;
  rootNote: number;
  notesPerBar: 1 | 2;
  totalDuration: number;
  onScaleChange: (scale: ScaleName) => void;
  onRootNoteChange: (rootNote: number) => void;
  onNotesPerBarChange: (notesPerBar: 1 | 2) => void;
  onTotalDurationChange: (duration: number) => void;
}

export function SonifyControls({
  scale,
  rootNote,
  notesPerBar,
  totalDuration,
  onScaleChange,
  onRootNoteChange,
  onNotesPerBarChange,
  onTotalDurationChange,
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
    </div>
  );
}
