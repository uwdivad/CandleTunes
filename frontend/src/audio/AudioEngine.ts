import * as Tone from "tone";

import type { NoteEvent, TrackInfo } from "../api/types";

type Instrument = Tone.Sampler | Tone.PolySynth;
type ScheduledNote = NoteEvent & { time: number };
type SimpleOscillatorType = "sine" | "triangle" | "sawtooth" | "square";

/** Voices the interactive (top) piano can play. */
export type ManualVoice =
  | "piano"
  | "meow"
  | "synth_triangle"
  | "synth_sine"
  | "synth_sawtooth"
  | "synth_square";

const VOLUME_RANGE_DB = 48;

const SYNTH_OSCILLATORS: Record<string, SimpleOscillatorType> = {
  synth_triangle: "triangle",
  synth_sine: "sine",
  synth_sawtooth: "sawtooth",
  synth_square: "square",
};

const SALAMANDER_BASE_URL = "https://tonejs.github.io/audio/salamander/";

const PIANO_SAMPLE_URLS: Record<string, string> = {
  A0: "A0.mp3", C1: "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3", A1: "A1.mp3",
  C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3", A2: "A2.mp3",
  C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3", A3: "A3.mp3",
  C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3", A4: "A4.mp3",
  C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3", A5: "A5.mp3",
  C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3", A6: "A6.mp3",
  C7: "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3", A7: "A7.mp3", C8: "C8.mp3",
};

// Single-sample "meow" instrument: one recording anchored at C4, which the
// Sampler pitch-shifts across the keyboard. Served from frontend/public/sounds/.
const MEOW_BASE_URL = "/sounds/";
const MEOW_SAMPLE_URLS: Record<string, string> = { C4: "miao.mp3" };

export class AudioEngine {
  private instruments: Map<number, Instrument> = new Map();
  private channels: Map<number, Tone.Channel> = new Map();
  private parts: Map<number, Tone.Part<ScheduledNote>> = new Map();
  private trackNotes: Map<number, ScheduledNote[]> = new Map();
  private noteCallbacks: {
    onNoteStart: (note: NoteEvent) => void;
    onNoteEnd: (note: NoteEvent) => void;
  } | null = null;
  /** Per-track offset between that track's playback position and the shared transport's. */
  private trackTimeDeltas: Map<number, number> = new Map();
  private masterVolume: Tone.Volume = new Tone.Volume(0);
  private reverb: Tone.Reverb = new Tone.Reverb({ decay: 1.5, wet: 0 });
  private delay: Tone.FeedbackDelay = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.3, wet: 0 });
  private recorder: Tone.Recorder = new Tone.Recorder();
  private loopEnabled = false;
  private loopDuration = 0;

  // Interactive (top) piano — its own voice/volume node and playing state.
  private manualVolume: Tone.Volume = new Tone.Volume(0);
  private manualInstrument: Instrument;
  private manualVoice: ManualVoice = "synth_triangle";
  private manualOctaveShift = 0;
  private manualSustain = false;
  /** pressed key midi -> actual sounding midi (after octave shift) */
  private manualActive: Map<number, number> = new Map();
  /** midis still ringing because the sustain pedal is held */
  private manualSustained: Set<number> = new Set();

  constructor() {
    this.masterVolume.chain(this.reverb, this.delay, Tone.getDestination());
    this.delay.connect(this.recorder);
    this.manualVolume.connect(this.masterVolume);
    this.manualInstrument = this.buildInstrument(this.manualVoice, this.manualVolume);
  }

  /** Build an instrument (sampler or synth) for the given name, routed to `destination`. */
  private buildInstrument(name: string, destination: Tone.ToneAudioNode): Instrument {
    if (name === "piano") {
      return new Tone.Sampler({
        urls: PIANO_SAMPLE_URLS,
        release: 1,
        baseUrl: SALAMANDER_BASE_URL,
      }).connect(destination);
    }
    if (name === "meow") {
      return new Tone.Sampler({
        urls: MEOW_SAMPLE_URLS,
        release: 1,
        baseUrl: MEOW_BASE_URL,
      }).connect(destination);
    }
    const oscType = SYNTH_OSCILLATORS[name] ?? "triangle";
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: oscType },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.6 },
    }).connect(destination);
  }

  async init(tracks: TrackInfo[]): Promise<void> {
    this.disposeAudioGraph();

    for (const track of tracks) {
      const channel = new Tone.Channel().connect(this.masterVolume);
      this.channels.set(track.track, channel);

      this.instruments.set(track.track, this.buildInstrument(track.instrument, channel));
    }

    await Promise.all([Tone.loaded(), this.reverb.ready]);
  }

  setVolume(percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent));
    this.masterVolume.volume.value = clamped <= 0 ? -Infinity : (clamped / 100) * VOLUME_RANGE_DB - VOLUME_RANGE_DB;
  }

  setTrackVolume(track: number, percent: number): void {
    const channel = this.channels.get(track);
    if (!channel) return;
    const clamped = Math.max(0, Math.min(100, percent));
    channel.volume.value = clamped <= 0 ? -Infinity : (clamped / 100) * VOLUME_RANGE_DB - VOLUME_RANGE_DB;
  }

  setTrackPan(track: number, value: number): void {
    const channel = this.channels.get(track);
    if (!channel) return;
    channel.pan.value = Math.max(-1, Math.min(1, value));
  }

  setTrackMute(track: number, muted: boolean): void {
    const channel = this.channels.get(track);
    if (!channel) return;
    channel.mute = muted;
  }

  setTrackSolo(track: number, solo: boolean): void {
    const channel = this.channels.get(track);
    if (!channel) return;
    channel.solo = solo;
  }

  setReverbAmount(percent: number): void {
    this.reverb.wet.value = Math.max(0, Math.min(100, percent)) / 100;
  }

  setDelayAmount(percent: number): void {
    this.delay.wet.value = Math.max(0, Math.min(100, percent)) / 100;
  }

  startRecording(): void {
    this.recorder.start();
  }

  async stopRecording(): Promise<Blob | null> {
    if (this.recorder.state !== "started") return null;
    return await this.recorder.stop();
  }

  schedule(
    notes: NoteEvent[],
    onNoteStart: (note: NoteEvent) => void,
    onNoteEnd: (note: NoteEvent) => void
  ): void {
    this.disposeParts();
    this.noteCallbacks = { onNoteStart, onNoteEnd };

    const byTrack = new Map<number, ScheduledNote[]>();
    for (const note of notes) {
      const list = byTrack.get(note.track);
      const scheduled: ScheduledNote = { ...note, time: note.time_sec };
      if (list) {
        list.push(scheduled);
      } else {
        byTrack.set(note.track, [scheduled]);
      }
    }

    this.trackNotes = byTrack;
    for (const [track, trackNotes] of byTrack) {
      this.startPart(track, trackNotes, 0, 0);
      this.trackTimeDeltas.set(track, 0);
    }
  }

  /** (Re)create a track's Part and start it at `startTime`, beginning playback from `offset`. */
  private startPart(track: number, notes: ScheduledNote[], startTime: number, offset: number): void {
    if (!this.noteCallbacks) return;
    const { onNoteStart, onNoteEnd } = this.noteCallbacks;

    const part = new Tone.Part<ScheduledNote>(
      (time, note) => {
        const instrument = this.instruments.get(note.track);
        if (!instrument) return;
        const freq = Tone.Frequency(note.pitch_midi, "midi").toFrequency();
        instrument.triggerAttackRelease(freq, note.duration_sec, time, note.velocity / 127);
        Tone.Draw.schedule(() => onNoteStart(note), time);
        Tone.Draw.schedule(() => onNoteEnd(note), time + note.duration_sec);
      },
      notes
    );

    part.loop = this.loopEnabled;
    part.loopEnd = this.loopDuration;
    part.start(startTime, offset);
    this.parts.set(track, part);
  }

  setLoop(enabled: boolean, durationSec: number): void {
    this.loopEnabled = enabled;
    this.loopDuration = durationSec;

    const transport = Tone.getTransport();
    transport.loop = enabled;
    transport.loopStart = 0;
    transport.loopEnd = durationSec;

    this.parts.forEach((part) => {
      part.loop = enabled;
      part.loopEnd = durationSec;
    });
  }

  async play(): Promise<void> {
    await Tone.start();
    Tone.getTransport().start();
  }

  pause(): void {
    Tone.getTransport().pause();
  }

  stop(): void {
    Tone.getTransport().stop();
  }

  seek(seconds: number): void {
    const transport = Tone.getTransport();

    // Independent tracks should hold their own position even when some other
    // (non-independent) track's chart drives a seek of the shared transport.
    const pinned: Array<{ track: number; time: number }> = [];
    this.trackTimeDeltas.forEach((delta, track) => {
      if (delta !== 0) pinned.push({ track, time: transport.seconds + delta });
    });

    transport.seconds = seconds;

    // Tone's transport doesn't report the new `seconds` synchronously after the
    // assignment above, so pass the target value explicitly rather than letting
    // `seekTrack` re-read (a stale) `transport.seconds`.
    pinned.forEach(({ track, time }) => this.seekTrack(track, time, seconds));
  }

  /**
   * Rewind the shared transport to 0 and re-sync every track (including independent
   * ones) back to it. Used when playback reaches the end and stops, so an independent
   * track doesn't accumulate an ever-larger offset each time the piece restarts.
   */
  resetToStart(): void {
    Tone.getTransport().seconds = 0;
    this.trackTimeDeltas.forEach((_, track) => this.seekTrack(track, 0, 0));
  }

  getCurrentTime(): number {
    return Tone.getTransport().seconds;
  }

  /**
   * Seek a single track to `seconds` without affecting the shared transport or any
   * other track. The track keeps playing from this position, offset from the
   * transport by a fixed delta, until it's re-synced via `syncTrack`.
   *
   * `nowOverride` lets callers supply the transport position to anchor against when
   * `transport.seconds` itself was just changed and hasn't settled yet (its getter can
   * briefly return a stale value immediately after being set).
   */
  seekTrack(track: number, seconds: number, nowOverride?: number): void {
    const notes = this.trackNotes.get(track);
    if (!notes) return;

    const transport = Tone.getTransport();
    const now = nowOverride ?? transport.seconds;
    const clamped = Math.max(0, seconds);

    this.parts.get(track)?.dispose();
    this.startPart(track, notes, now, clamped);
    this.trackTimeDeltas.set(track, clamped - now);
  }

  /** Current playback position of a single track, accounting for any independent seek. */
  getTrackTime(track: number): number {
    const delta = this.trackTimeDeltas.get(track) ?? 0;
    return Tone.getTransport().seconds + delta;
  }

  /** Re-sync a track back to the shared transport position. */
  syncTrack(track: number): void {
    this.seekTrack(track, this.getCurrentTime());
  }

  /** Swap the interactive piano's sound. Releases anything currently held. */
  setManualVoice(voice: ManualVoice): void {
    if (voice === this.manualVoice) return;
    this.manualVoice = voice;
    this.manualInstrument.releaseAll?.();
    this.manualInstrument.dispose();
    this.manualActive.clear();
    this.manualSustained.clear();
    this.manualInstrument = this.buildInstrument(voice, this.manualVolume);
  }

  setManualVolume(percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent));
    this.manualVolume.volume.value = clamped <= 0 ? -Infinity : (clamped / 100) * VOLUME_RANGE_DB - VOLUME_RANGE_DB;
  }

  /** Shift every played note by this many octaves (e.g. -2..+2). */
  setManualOctaveShift(octaves: number): void {
    this.manualOctaveShift = octaves;
  }

  /** Toggle the sustain pedal. Releasing it drops any notes still ringing. */
  setManualSustain(enabled: boolean): void {
    this.manualSustain = enabled;
    if (enabled) return;
    const held = new Set(this.manualActive.values());
    this.manualSustained.forEach((midi) => {
      if (!held.has(midi)) {
        this.manualInstrument.triggerRelease(Tone.Frequency(midi, "midi").toFrequency());
      }
    });
    this.manualSustained.clear();
  }

  playManualNote(pitchMidi: number, velocity: number = 80): void {
    const actual = Math.max(0, Math.min(127, pitchMidi + this.manualOctaveShift * 12));
    this.manualActive.set(pitchMidi, actual);
    this.manualSustained.delete(actual);
    const freq = Tone.Frequency(actual, "midi").toFrequency();
    this.manualInstrument.triggerAttack(freq, undefined, velocity / 127);
  }

  stopManualNote(pitchMidi: number): void {
    const actual = this.manualActive.get(pitchMidi);
    if (actual === undefined) return;
    this.manualActive.delete(pitchMidi);
    if (this.manualSustain) {
      this.manualSustained.add(actual);
      return;
    }
    // Another held key may still be sounding this pitch — don't cut it off.
    if (![...this.manualActive.values()].includes(actual)) {
      this.manualInstrument.triggerRelease(Tone.Frequency(actual, "midi").toFrequency());
    }
  }

  /** Tear down the current instruments/parts without touching transport position. */
  private disposeAudioGraph(): void {
    this.disposeParts();
    this.instruments.forEach((instrument) => instrument.dispose());
    this.instruments.clear();
    this.channels.forEach((channel) => channel.dispose());
    this.channels.clear();
  }

  private disposeParts(): void {
    this.parts.forEach((part) => part.dispose());
    this.parts.clear();
    this.trackNotes.clear();
    this.noteCallbacks = null;
    this.trackTimeDeltas.clear();
  }

  dispose(): void {
    this.disposeAudioGraph();
    // manualInstrument is intentionally left intact — dispose() is also used when
    // the track list is emptied, and the interactive piano must survive that.
    Tone.getTransport().stop();
    Tone.getTransport().seconds = 0;
  }
}
