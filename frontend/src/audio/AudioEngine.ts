import * as Tone from "tone";

import type { NoteEvent, TrackInfo } from "../api/types";

type Instrument = Tone.Sampler | Tone.PolySynth;
type ScheduledNote = NoteEvent & { time: number };
type SimpleOscillatorType = "sine" | "triangle" | "sawtooth" | "square";

const VOLUME_RANGE_DB = 48;

const SYNTH_OSCILLATORS: Record<string, SimpleOscillatorType> = {
  synth_triangle: "triangle",
  synth_sine: "sine",
  synth_sawtooth: "sawtooth",
};

const PIANO_SAMPLE_URLS: Record<string, string> = {
  A0: "A0.mp3", C1: "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3", A1: "A1.mp3",
  C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3", A2: "A2.mp3",
  C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3", A3: "A3.mp3",
  C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3", A4: "A4.mp3",
  C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3", A5: "A5.mp3",
  C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3", A6: "A6.mp3",
  C7: "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3", A7: "A7.mp3", C8: "C8.mp3",
};

export class AudioEngine {
  private instruments: Map<number, Instrument> = new Map();
  private part: Tone.Part<ScheduledNote> | null = null;
  private masterVolume: Tone.Volume = new Tone.Volume(0).toDestination();
  private recorder: Tone.Recorder = new Tone.Recorder();
  private manualSynth: Tone.PolySynth;

  constructor() {
    this.masterVolume.connect(this.recorder);
    this.manualSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.6 },
    }).connect(this.masterVolume);
  }

  async init(tracks: TrackInfo[]): Promise<void> {
    this.disposeAudioGraph();

    for (const track of tracks) {
      if (track.instrument === "piano") {
        const sampler = new Tone.Sampler({
          urls: PIANO_SAMPLE_URLS,
          release: 1,
          baseUrl: "https://tonejs.github.io/audio/salamander/",
        }).connect(this.masterVolume);
        this.instruments.set(track.track, sampler);
      } else {
        const oscType = SYNTH_OSCILLATORS[track.instrument] ?? "triangle";
        const synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: oscType },
          envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.6 },
        }).connect(this.masterVolume);
        this.instruments.set(track.track, synth);
      }
    }

    await Tone.loaded();
  }

  setVolume(percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent));
    this.masterVolume.volume.value = clamped <= 0 ? -Infinity : (clamped / 100) * VOLUME_RANGE_DB - VOLUME_RANGE_DB;
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
    this.part?.dispose();

    this.part = new Tone.Part<ScheduledNote>(
      (time, note) => {
        const instrument = this.instruments.get(note.track);
        if (!instrument) return;
        const freq = Tone.Frequency(note.pitch_midi, "midi").toFrequency();
        instrument.triggerAttackRelease(freq, note.duration_sec, time, note.velocity / 127);
        Tone.Draw.schedule(() => onNoteStart(note), time);
        Tone.Draw.schedule(() => onNoteEnd(note), time + note.duration_sec);
      },
      notes.map((n): ScheduledNote => ({ ...n, time: n.time_sec }))
    );

    this.part.start(0);
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
    Tone.getTransport().seconds = seconds;
  }

  getCurrentTime(): number {
    return Tone.getTransport().seconds;
  }

  playManualNote(pitchMidi: number, velocity: number = 80): void {
    const freq = Tone.Frequency(pitchMidi, "midi").toFrequency();
    this.manualSynth.triggerAttack(freq, undefined, velocity / 127);
  }

  stopManualNote(pitchMidi: number): void {
    const freq = Tone.Frequency(pitchMidi, "midi").toFrequency();
    this.manualSynth.triggerRelease(freq);
  }

  /** Tear down the current instruments/part without touching transport position. */
  private disposeAudioGraph(): void {
    this.part?.dispose();
    this.part = null;
    this.instruments.forEach((instrument) => instrument.dispose());
    this.instruments.clear();
  }

  dispose(): void {
    this.disposeAudioGraph();
    Tone.getTransport().stop();
    Tone.getTransport().seconds = 0;
  }
}
