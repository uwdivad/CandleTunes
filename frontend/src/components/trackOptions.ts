import type { ChordMode } from "../api/types";

export const CHORD_MODES: { value: ChordMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "triad", label: "Triad" },
  { value: "power", label: "Power Chord" },
];

export const ROOT_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const INSTRUMENTS = [
  { value: "", label: "Auto (Default)" },
  { value: "piano", label: "Piano" },
  { value: "synth_triangle", label: "Synth Triangle" },
  { value: "synth_sine", label: "Synth Sine" },
  { value: "synth_sawtooth", label: "Synth Sawtooth" },
];

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
