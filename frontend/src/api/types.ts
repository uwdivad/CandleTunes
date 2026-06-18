export interface User {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartResponse {
  ticker: string;
  interval: string;
  bars: OHLCVBar[];
}

export type ScaleName =
  | "major"
  | "minor"
  | "pentatonic_major"
  | "pentatonic_minor"
  | "chromatic";

export type ChordMode = "off" | "triad" | "power";

export interface TrackRequest {
  ticker: string;
  start: string;
  end: string;
  interval?: string;
  register_base_midi?: number | null;
  pitch_range_semitones?: number;
  instrument?: string | null;
  scale?: ScaleName | null;
  root_note?: number | null;
  notes_per_bar?: 1 | 2 | null;
  chord_mode?: ChordMode | null;
}

export interface TrackConfig {
  instrument?: string;
  scale?: ScaleName;
  rootNote?: number;
  notesPerBar?: 1 | 2;
  registerBaseMidi?: number;
  chordMode?: ChordMode;
}

export interface TrackMixerSettings {
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
}

export const DEFAULT_TRACK_MIXER: TrackMixerSettings = {
  volume: 100,
  pan: 0,
  mute: false,
  solo: false,
};

export interface SonifyRequest {
  tracks: TrackRequest[];
  bpm?: number;
  total_duration_sec?: number;
  notes_per_bar: 1 | 2;
  scale: ScaleName;
  root_note: number;
  global_instrument?: string | null;
  legato?: number;
  swing?: number;
  chord_mode?: ChordMode;
}

export interface NoteEvent {
  time_sec: number;
  pitch_midi: number;
  duration_sec: number;
  velocity: number;
  track: number;
  ticker: string;
}

export interface TrackInfo {
  track: number;
  ticker: string;
  instrument: string;
  register_base_midi: number;
  bar_count: number;
}

export interface SonifyResponse {
  notes: NoteEvent[];
  tracks: TrackInfo[];
  total_duration_sec: number;
}

export interface MidiExportRequest {
  notes: NoteEvent[];
  tracks: TrackInfo[];
}

export interface MoverItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
}

export interface MoversResponse {
  gainers: MoverItem[];
  losers: MoverItem[];
}
