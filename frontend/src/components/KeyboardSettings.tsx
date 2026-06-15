import type { ManualVoice } from "../audio/AudioEngine";

const MANUAL_VOICES: { value: ManualVoice; label: string }[] = [
  { value: "piano", label: "Grand Piano" },
  // { value: "meow", label: "Meow 🐱" },  // hidden for now — engine support stays in AudioEngine
  { value: "synth_triangle", label: "Synth Triangle" },
  { value: "synth_sine", label: "Synth Sine" },
  { value: "synth_sawtooth", label: "Synth Saw" },
  { value: "synth_square", label: "Synth Square" },
];

interface KeyboardSettingsProps {
  voice: ManualVoice;
  octaveShift: number;
  sustain: boolean;
  volume: number;
  computerKeys: boolean;
  showLabels: boolean;
  onVoiceChange: (voice: ManualVoice) => void;
  onOctaveShiftChange: (shift: number) => void;
  onSustainChange: (on: boolean) => void;
  onVolumeChange: (volume: number) => void;
  onComputerKeysChange: (on: boolean) => void;
  onShowLabelsChange: (on: boolean) => void;
}

const OCTAVE_MIN = -3;
const OCTAVE_MAX = 3;

export function KeyboardSettings({
  voice,
  octaveShift,
  sustain,
  volume,
  computerKeys,
  showLabels,
  onVoiceChange,
  onOctaveShiftChange,
  onSustainChange,
  onVolumeChange,
  onComputerKeysChange,
  onShowLabelsChange,
}: KeyboardSettingsProps) {
  return (
    <div className="keyboard-settings">
      <label className="inline-field">
        Voice
        <select value={voice} onChange={(e) => onVoiceChange(e.target.value as ManualVoice)}>
          {MANUAL_VOICES.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </label>

      <div className="inline-field">
        Octave
        <div className="octave-stepper">
          <button
            type="button"
            onClick={() => onOctaveShiftChange(Math.max(OCTAVE_MIN, octaveShift - 1))}
            disabled={octaveShift <= OCTAVE_MIN}
            aria-label="Octave down"
          >
            −
          </button>
          <span className="octave-value">{octaveShift > 0 ? `+${octaveShift}` : octaveShift}</span>
          <button
            type="button"
            onClick={() => onOctaveShiftChange(Math.min(OCTAVE_MAX, octaveShift + 1))}
            disabled={octaveShift >= OCTAVE_MAX}
            aria-label="Octave up"
          >
            +
          </button>
        </div>
      </div>

      <label className="inline-field volume-field">
        Volume
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
        />
      </label>

      <button
        type="button"
        className={`toggle-btn ${sustain ? "active" : ""}`}
        onClick={() => onSustainChange(!sustain)}
        title="Sustain pedal — held notes keep ringing"
      >
        Sustain
      </button>

      <button
        type="button"
        className={`toggle-btn ${computerKeys ? "active" : ""}`}
        onClick={() => onComputerKeysChange(!computerKeys)}
        title="Play with your computer keyboard (A W S E D F T G Y H U J K)"
      >
        ⌨ Keys
      </button>

      <label className="toggle-check">
        <input
          type="checkbox"
          checked={showLabels}
          onChange={(e) => onShowLabelsChange(e.target.checked)}
        />
        Labels
      </label>
    </div>
  );
}
