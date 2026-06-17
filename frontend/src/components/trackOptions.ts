import type { ManualVoice } from "../audio/AudioEngine";
import type { ChordMode } from "../api/types";

export const CHORD_MODES: { value: ChordMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "triad", label: "Triad" },
  { value: "power", label: "Power Chord" },
];

export const ROOT_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * The single source of truth for selectable instrument sounds, shared by both the
 * per-track config and the interactive piano so the two never drift apart.
 */
export const VOICES: { value: ManualVoice; label: string }[] = [
  { value: "piano", label: "Piano" },
  // { value: "meow", label: "Meow 🐱" },  // hidden for now — engine support stays in AudioEngine
  { value: "synth_triangle", label: "Synth Triangle" },
  { value: "synth_sine", label: "Synth Sine" },
  { value: "synth_sawtooth", label: "Synth Sawtooth" },
  { value: "synth_square", label: "Synth Square" },
];

// Per-track instrument picker: the shared voices plus an "Auto" option (tracks
// auto-assign an instrument when none is chosen; the interactive piano can't).
export const INSTRUMENTS = [{ value: "", label: "Auto (Default)" }, ...VOICES];

export const OCTAVES = [
  { value: "", label: "Auto" },
  { value: "36", label: "C2 (Very Low)" },
  { value: "48", label: "C3 (Low)" },
  { value: "60", label: "C4 (Mid)" },
  { value: "72", label: "C5 (High)" },
  { value: "84", label: "C6 (Very High)" },
];

export const SCALES = [
  { value: "", label: "Global Default" },
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
  { value: "pentatonic_major", label: "Pentatonic Major" },
  { value: "pentatonic_minor", label: "Pentatonic Minor" },
  { value: "chromatic", label: "Chromatic" },
];
