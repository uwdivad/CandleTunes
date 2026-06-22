import { useEffect, useRef, useState } from "react";

import { useMidiExport, useSonify } from "../api/queries";
import { DEFAULT_TRACK_MIXER, type AssistantSettings, type ChordMode, type ScaleName, type SonifyResponse, type TrackConfig, type TrackMixerSettings } from "../api/types";
import { AudioEngine, type ManualVoice } from "../audio/AudioEngine";
import { colorForTrack } from "../audio/trackColors";
import { MAX_TICKERS } from "../constants";
import { AssistantPanel } from "../components/AssistantPanel";
import { AuthButton } from "../components/AuthButton";
import { ChartLoadingPanel } from "../components/ChartLoadingPanel";
import { DateRangePicker } from "../components/DateRangePicker";
import { KeyboardSettings } from "../components/KeyboardSettings";
import { PianoKeyboard } from "../components/PianoKeyboard";
import { SonifyControls } from "../components/SonifyControls";
import { TickerChartPanel } from "../components/TickerChartPanel";
import { TickerInput } from "../components/TickerInput";
import { TopMovers } from "../components/TopMovers";
import { TransportControls } from "../components/TransportControls";
import { usePlaybackStore } from "../state/playbackStore";
import { downloadBlob } from "../utils/download";

function defaultDates() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 12);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const TICKERS_STORAGE_KEY = "candletunes.tickers";
const LEGACY_TICKERS_STORAGE_KEY = "candlemusic.tickers";
const GENERATION_DEBOUNCE_MS = 500;

// Computer-keyboard → MIDI map (one+ octave, home row = C4). Octave shift is
// applied downstream by the AudioEngine, so these stay fixed.
const COMPUTER_KEY_MAP: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66,
  g: 67, y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74,
};

function loadStoredTickers(): string[] {
  try {
    const raw = localStorage.getItem(TICKERS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_TICKERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.every((t) => typeof t === "string") && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // ignore malformed storage
  }
  return ["AAPL"];
}

export function HomePage() {
  const [tickers, setTickers] = useState<string[]>(loadStoredTickers);
  const [range, setRange] = useState(defaultDates());
  const [scale, setScale] = useState<ScaleName>("major");
  const [rootNote, setRootNote] = useState(0);
  const [notesPerBar, setNotesPerBar] = useState<1 | 2>(1);
  const [speedMode, setSpeedMode] = useState<'bpm' | 'duration'>('bpm');
  const [bpm, setBpm] = useState(120);
  const [totalDuration, setTotalDuration] = useState(60);
  const [globalInstrument, setGlobalInstrument] = useState<string>('');
  const [legato, setLegato] = useState(0.9);
  const [swing, setSwing] = useState(0);
  const [chordMode, setChordMode] = useState<ChordMode>('off');
  const [composition, setComposition] = useState<SonifyResponse | null>(null);
  const [volume, setVolume] = useState(50);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [reverb, setReverb] = useState(0);
  const [delay, setDelay] = useState(0);
  const [showLabels, setShowLabels] = useState(false);
  // Interactive (top) piano settings.
  const [manualVoice, setManualVoice] = useState<ManualVoice>("synth_triangle");
  const [manualOctave, setManualOctave] = useState(0);
  const [manualSustain, setManualSustain] = useState(false);
  const [manualVolume, setManualVolume] = useState(70);
  const [computerKeys, setComputerKeys] = useState(false);
  const [computerPressed, setComputerPressed] = useState<Set<number>>(new Set());
  const [customColors, setCustomColors] = useState<Record<string, string>>({});
  const [trackConfigs, setTrackConfigs] = useState<Record<string, TrackConfig>>({});
  const [trackMixer, setTrackMixer] = useState<Record<string, TrackMixerSettings>>({});
  // Tracks given their own independent playback position, decoupled from the shared transport.
  const [independentTracks, setIndependentTracks] = useState<Set<number>>(new Set());
  const [trackTimes, setTrackTimes] = useState<Record<number, number>>({});
  // Tickers (by symbol) whose per-track settings the assistant locked. A global
  // control change skips these unless the "override locks" toggle is active.
  const [lockedTracks, setLockedTracks] = useState<Set<string>>(new Set());
  const [overrideLocks, setOverrideLocks] = useState(false);

  const getMixer = (ticker: string): TrackMixerSettings => trackMixer[ticker] || DEFAULT_TRACK_MIXER;

  const handleTrackMixerChange = (ticker: string, partial: Partial<TrackMixerSettings>) => {
    setTrackMixer((prev) => ({ ...prev, [ticker]: { ...getMixer(ticker), ...partial } }));
  };

  const resolveColor = (ticker: string, trackIndex: number) => {
    return customColors[ticker] || colorForTrack(trackIndex);
  };

  const handleColorChange = (ticker: string, color: string) => {
    setCustomColors((prev) => ({ ...prev, [ticker]: color }));
  };

  const handleTrackConfigChange = (ticker: string, config: TrackConfig) => {
    setTrackConfigs((prev) => ({ ...prev, [ticker]: config }));
  };

  // Tickers whose chart has its own independent playback timeline. Changing a
  // global control leaves these alone; every other chart gets its matching
  // per-track override cleared so the new global value wins.
  const independentTickers = (): Set<string> => {
    const result = new Set<string>();
    for (const t of composition?.tracks ?? []) {
      if (independentTracks.has(t.track)) result.add(t.ticker);
    }
    return result;
  };

  // Drop a per-track override field from every non-independent track so the
  // global setting takes effect there. Tracks with their own timeline always
  // keep their override; assistant-locked tracks keep it too unless the global
  // "override locks" toggle is active.
  const clearTrackOverride = (field: keyof TrackConfig) => {
    const indep = independentTickers();
    setTrackConfigs((prev) => {
      const next: Record<string, TrackConfig> = {};
      for (const [ticker, cfg] of Object.entries(prev)) {
        const lockedFromGlobal = lockedTracks.has(ticker) && !overrideLocks;
        if (indep.has(ticker) || lockedFromGlobal) {
          next[ticker] = cfg;
        } else {
          const rest = { ...cfg };
          delete rest[field];
          next[ticker] = rest;
        }
      }
      return next;
    });
  };

  const handleToggleLock = (ticker: string) => {
    setLockedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };

  // Global SonifyControls setters that overlap a per-track config field: apply
  // the global value and clear the matching override on non-independent charts.
  const handleGlobalScaleChange = (value: ScaleName) => {
    setScale(value);
    clearTrackOverride("scale");
  };
  const handleGlobalRootNoteChange = (value: number) => {
    setRootNote(value);
    clearTrackOverride("rootNote");
  };
  const handleGlobalNotesPerBarChange = (value: 1 | 2) => {
    setNotesPerBar(value);
    clearTrackOverride("notesPerBar");
  };
  const handleGlobalChordModeChange = (value: ChordMode) => {
    setChordMode(value);
    clearTrackOverride("chordMode");
  };
  const handleGlobalInstrumentChange = (value: string) => {
    setGlobalInstrument(value);
    clearTrackOverride("instrument");
  };

  // Snapshot of the current musical state, sent to the arranger so it only
  // changes what it means to change.
  const buildCurrentSettings = (): AssistantSettings => ({
    scale,
    root_note: rootNote,
    notes_per_bar: notesPerBar,
    speed_mode: speedMode,
    bpm,
    total_duration_sec: totalDuration,
    global_instrument: globalInstrument || undefined,
    legato,
    swing,
    chord_mode: chordMode,
    tracks: Object.fromEntries(
      tickers.map((ticker) => [
        ticker,
        {
          instrument: trackConfigs[ticker]?.instrument,
          scale: trackConfigs[ticker]?.scale,
          root_note: trackConfigs[ticker]?.rootNote,
          notes_per_bar: trackConfigs[ticker]?.notesPerBar,
          register_base_midi: trackConfigs[ticker]?.registerBaseMidi as
            | 36 | 48 | 60 | 72 | 84 | undefined,
          chord_mode: trackConfigs[ticker]?.chordMode,
          color: customColors[ticker],
        },
      ])
    ),
  });

  // Apply an arranger patch onto the existing controls. The debounced
  // re-sonify effect (keyed on these setters' state) fires automatically.
  const applyAssistantSettings = (s: AssistantSettings) => {
    // The backend serializes the patch with explicit `null` for fields the
    // assistant left unchanged, so guard with `!= null` (not `!== undefined`)
    // — otherwise a null overwrites good numeric state and crashes the controls.
    if (s.scale != null) setScale(s.scale);
    if (s.root_note != null) setRootNote(s.root_note);
    if (s.notes_per_bar != null) setNotesPerBar(s.notes_per_bar);
    if (s.speed_mode != null) setSpeedMode(s.speed_mode);
    if (s.bpm != null) setBpm(s.bpm);
    if (s.total_duration_sec != null) setTotalDuration(s.total_duration_sec);
    if (s.global_instrument != null) setGlobalInstrument(s.global_instrument);
    if (s.legato != null) setLegato(s.legato);
    if (s.swing != null) setSwing(s.swing);
    if (s.chord_mode != null) setChordMode(s.chord_mode);

    if (s.tracks) {
      for (const [ticker, t] of Object.entries(s.tracks)) {
        if (t.color != null) handleColorChange(ticker, t.color);
        // Map snake_case patch → camelCase TrackConfig, merging with existing
        // config (handleTrackConfigChange replaces the whole entry).
        const patch: TrackConfig = {};
        if (t.instrument != null) patch.instrument = t.instrument;
        if (t.scale != null) patch.scale = t.scale;
        if (t.root_note != null) patch.rootNote = t.root_note;
        if (t.notes_per_bar != null) patch.notesPerBar = t.notes_per_bar;
        if (t.register_base_midi != null) patch.registerBaseMidi = t.register_base_midi;
        if (t.chord_mode != null) patch.chordMode = t.chord_mode;
        if (Object.keys(patch).length > 0) {
          setTrackConfigs((prev) => ({ ...prev, [ticker]: { ...prev[ticker], ...patch } }));
          // Lock the assistant's per-track arrangement so a later global change
          // doesn't quietly wipe it (unless the user enables "override locks").
          setLockedTracks((prev) => new Set(prev).add(ticker));
        }
      }
    }
  };

  // Reset every form value to its default by clearing the persisted state and
  // reloading, so all the local component state re-initializes from scratch.
  // Sign-in is preserved (the auth token is not a form value).
  const handleResetDefaults = () => {
    if (!window.confirm("Reset all settings to defaults? This clears your saved tickers and musical settings.")) return;
    localStorage.removeItem(TICKERS_STORAGE_KEY);
    localStorage.removeItem(LEGACY_TICKERS_STORAGE_KEY);
    window.location.reload();
  };

  const audioEngineRef = useRef<AudioEngine | null>(null);
  if (audioEngineRef.current === null) {
    audioEngineRef.current = new AudioEngine();
  }
  const audioEngine = audioEngineRef.current;
  const animationRef = useRef<number | null>(null);
  // Source of truth for keys currently held on the computer keyboard. Kept in a
  // ref (not state) so the audio side-effects stay out of the render/setState path
  // — calling them inside a setState updater double-fires under StrictMode and
  // leaves stuck (sustained) synth voices.
  const computerPressedRef = useRef<Set<number>>(new Set());

  const sonifyMutation = useSonify();
  const midiMutation = useMidiExport();

  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const activeNotes = usePlaybackStore((s) => s.activeNotes);
  const setPlaying = usePlaybackStore((s) => s.setPlaying);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const noteOn = usePlaybackStore((s) => s.noteOn);
  const noteOff = usePlaybackStore((s) => s.noteOff);
  const clearActiveNotes = usePlaybackStore((s) => s.clearActiveNotes);
  const reset = usePlaybackStore((s) => s.reset);

  useEffect(() => {
    return () => {
      audioEngine.dispose();
    };
  }, []);

  useEffect(() => {
    audioEngine.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    audioEngine.setReverbAmount(reverb);
  }, [reverb]);

  useEffect(() => {
    audioEngine.setDelayAmount(delay);
  }, [delay]);

  useEffect(() => {
    audioEngine.setManualVoice(manualVoice);
  }, [manualVoice]);

  useEffect(() => {
    audioEngine.setManualVolume(manualVolume);
  }, [manualVolume]);

  useEffect(() => {
    audioEngine.setManualOctaveShift(manualOctave);
  }, [manualOctave]);

  useEffect(() => {
    audioEngine.setManualSustain(manualSustain);
  }, [manualSustain]);

  // Play the interactive piano with the computer keyboard when enabled.
  useEffect(() => {
    if (!computerKeys) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) {
        return;
      }
      const midi = COMPUTER_KEY_MAP[e.key.toLowerCase()];
      if (midi === undefined) return;
      e.preventDefault();
      if (computerPressedRef.current.has(midi)) return;
      computerPressedRef.current.add(midi);
      audioEngine.playManualNote(midi);
      setComputerPressed(new Set(computerPressedRef.current));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const midi = COMPUTER_KEY_MAP[e.key.toLowerCase()];
      if (midi === undefined) return;
      if (!computerPressedRef.current.has(midi)) return;
      computerPressedRef.current.delete(midi);
      audioEngine.stopManualNote(midi);
      setComputerPressed(new Set(computerPressedRef.current));
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computerKeys]);

  useEffect(() => {
    if (!composition) return;
    audioEngine.setLoop(isLooping && !isRecordingAudio, composition.total_duration_sec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLooping, composition, isRecordingAudio]);

  useEffect(() => {
    if (!composition) return;
    for (const track of composition.tracks) {
      const mixer = getMixer(track.ticker);
      audioEngine.setTrackVolume(track.track, mixer.volume);
      audioEngine.setTrackPan(track.track, mixer.pan);
      audioEngine.setTrackMute(track.track, mixer.mute);
      audioEngine.setTrackSolo(track.track, mixer.solo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composition, trackMixer]);

  useEffect(() => {
    localStorage.setItem(TICKERS_STORAGE_KEY, JSON.stringify(tickers));
  }, [tickers]);

  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      return;
    }

    const tick = () => {
      const t = audioEngine.getCurrentTime();
      if (composition && t >= composition.total_duration_sec) {
        if (isLooping && !isRecordingAudio) {
          setCurrentTime(0);
          animationRef.current = requestAnimationFrame(tick);
          return;
        }
        audioEngine.pause();
        audioEngine.resetToStart();
        setPlaying(false);
        setCurrentTime(0);
        setTrackTimes({});
        if (isRecordingAudio) {
          audioEngine.stopRecording().then((blob) => {
            if (!blob) return;
            const ext = blob.type.includes("mp4") ? "mp4" : "webm";
            downloadBlob(blob, `candletunes.${ext}`);
          });
          setIsRecordingAudio(false);
        }
        return;
      }
      setCurrentTime(t);
      if (independentTracks.size > 0) {
        setTrackTimes((prev) => {
          const next = { ...prev };
          independentTracks.forEach((track) => {
            next[track] = audioEngine.getTrackTime(track);
          });
          return next;
        });
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, composition, setCurrentTime, setPlaying, isRecordingAudio, isLooping, independentTracks]);

  const generationRequestRef = useRef(0);

  useEffect(() => {
    const requestId = ++generationRequestRef.current;

    if (tickers.length === 0) {
      // Tear down audio immediately; clear React state in the deferred callback
      // below so we don't trigger a cascading render from inside the effect body.
      audioEngine.dispose();
      reset();
    }

    const timer = setTimeout(async () => {
      if (generationRequestRef.current !== requestId) return;

      if (tickers.length === 0) {
        setComposition(null);
        return;
      }

      try {
        const result = await sonifyMutation.mutateAsync({
          tracks: tickers.map((ticker) => ({
            ticker,
            start: range.start,
            end: range.end,
            instrument: trackConfigs[ticker]?.instrument,
            scale: trackConfigs[ticker]?.scale,
            root_note: trackConfigs[ticker]?.rootNote,
            notes_per_bar: trackConfigs[ticker]?.notesPerBar,
            register_base_midi: trackConfigs[ticker]?.registerBaseMidi,
            chord_mode: trackConfigs[ticker]?.chordMode,
          })),
          bpm: speedMode === 'bpm' ? bpm : undefined,
          total_duration_sec: speedMode === 'duration' ? totalDuration : undefined,
          notes_per_bar: notesPerBar,
          scale,
          root_note: rootNote,
          global_instrument: globalInstrument || undefined,
          legato,
          swing,
          chord_mode: chordMode,
        });

        if (generationRequestRef.current !== requestId) return;

        clearActiveNotes();
        await audioEngine.init(result.tracks);
        if (generationRequestRef.current !== requestId) return;

        audioEngine.schedule(
          result.notes,
          (note) => noteOn(note.track, note.pitch_midi),
          (note) => noteOff(note.track, note.pitch_midi)
        );
        setIndependentTracks(new Set());
        setTrackTimes({});
        setComposition(result);
      } catch {
        // surfaced via sonifyMutation.error
      }
    }, GENERATION_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers, range.start, range.end, scale, rootNote, notesPerBar, speedMode, bpm, totalDuration, globalInstrument, legato, swing, chordMode, trackConfigs]);

  const handlePlayPause = async () => {
    if (!composition) return;
    if (isPlaying) {
      audioEngine.pause();
      setPlaying(false);
    } else {
      await audioEngine.play();
      setPlaying(true);
    }
  };

  const handleSeek = (time: number) => {
    const clamped = composition ? Math.max(0, Math.min(time, composition.total_duration_sec)) : Math.max(0, time);
    audioEngine.seek(clamped);
    setCurrentTime(clamped);
  };

  const handleSeekTrack = (track: number, time: number) => {
    const clamped = composition ? Math.max(0, Math.min(time, composition.total_duration_sec)) : Math.max(0, time);
    audioEngine.seekTrack(track, clamped);
    setTrackTimes((prev) => ({ ...prev, [track]: clamped }));
  };

  const handleToggleIndependent = (track: number) => {
    setIndependentTracks((prev) => {
      const next = new Set(prev);
      if (next.has(track)) {
        next.delete(track);
        audioEngine.syncTrack(track);
      } else {
        next.add(track);
        audioEngine.seekTrack(track, currentTime);
        setTrackTimes((prevTimes) => ({ ...prevTimes, [track]: currentTime }));
      }
      return next;
    });
  };

  const handleDownloadMidi = () => {
    if (!composition) return;
    midiMutation.mutate({ notes: composition.notes, tracks: composition.tracks });
  };

  const handleDownloadAudio = async () => {
    if (!composition || isRecordingAudio || isPlaying) return;
    setIsRecordingAudio(true);
    audioEngine.resetToStart();
    setCurrentTime(0);
    setTrackTimes({});
    audioEngine.startRecording();
    await audioEngine.play();
    setPlaying(true);
  };

  const handleStopRecording = () => {
    audioEngine.pause();
    audioEngine.resetToStart();
    setPlaying(false);
    setCurrentTime(0);
    setTrackTimes({});
    setIsRecordingAudio(false);
    audioEngine.stopRecording().then((blob) => {
      if (!blob) return;
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      downloadBlob(blob, `candletunes.${ext}`);
    });
  };

  const handleComputerKeysChange = (on: boolean) => {
    if (!on) {
      // Release any notes still held by the computer keyboard before disabling.
      computerPressedRef.current.forEach((midi) => audioEngine.stopManualNote(midi));
      computerPressedRef.current = new Set();
      setComputerPressed(new Set());
    }
    setComputerKeys(on);
  };

  const handlePlayManualNote = (midi: number) => {
    audioEngine.playManualNote(midi);
  };

  const handleStopManualNote = (midi: number) => {
    audioEngine.stopManualNote(midi);
  };

  return (
    <div className="studio-layout">
      <aside className="sidebar">
        <header>
          <h1>CandleTunes</h1>
          <p className="subtitle">Turn market movement into tunes.</p>
        </header>

        <AuthButton />

        <TopMovers
          tickers={tickers}
          onAddTicker={(symbol) => {
            if (!tickers.includes(symbol) && tickers.length < MAX_TICKERS) {
              setTickers([...tickers, symbol]);
            }
          }}
        />

        <section className="controls">
          <TickerInput
            tickers={tickers}
            onChange={setTickers}
            colorForTrack={resolveColor}
            onColorChange={handleColorChange}
            trackConfigs={trackConfigs}
            onTrackConfigChange={handleTrackConfigChange}
            trackMixer={trackMixer}
            onTrackMixerChange={handleTrackMixerChange}
          />
          <DateRangePicker
            start={range.start}
            end={range.end}
            onChange={(start, end) => setRange({ start, end })}
          />
          <SonifyControls
            scale={scale}
            rootNote={rootNote}
            notesPerBar={notesPerBar}
            bpm={bpm}
            totalDuration={totalDuration}
            speedMode={speedMode}
            globalInstrument={globalInstrument}
            legato={legato}
            swing={swing}
            chordMode={chordMode}
            onScaleChange={handleGlobalScaleChange}
            onRootNoteChange={handleGlobalRootNoteChange}
            onNotesPerBarChange={handleGlobalNotesPerBarChange}
            onBpmChange={setBpm}
            onTotalDurationChange={setTotalDuration}
            onSpeedModeChange={setSpeedMode}
            onGlobalInstrumentChange={handleGlobalInstrumentChange}
            onLegatoChange={setLegato}
            onSwingChange={setSwing}
            onChordModeChange={handleGlobalChordModeChange}
            overrideLocks={overrideLocks}
            onOverrideLocksChange={setOverrideLocks}
          />
          <AssistantPanel
            tickers={tickers}
            dateRange={range}
            currentSettings={buildCurrentSettings()}
            onApply={applyAssistantSettings}
          />
          {sonifyMutation.isPending && <p className="status-text">Updating…</p>}
          {sonifyMutation.isError && (
            <p className="error">{(sonifyMutation.error as Error).message}</p>
          )}
          {!sonifyMutation.isPending && composition?.failed && composition.failed.length > 0 && (
            <p className="error">
              Skipped {composition.failed.map((f) => f.ticker).join(', ')} — no data available.
            </p>
          )}
          <button type="button" className="reset-defaults-btn" onClick={handleResetDefaults}>
            Reset to defaults
          </button>
        </section>
      </aside>

      <main className="main-content">
        {!composition ? (
          tickers.length === 0 ? (
            <div className="empty-state">
              <h2>Ready to make music</h2>
              <p>Add some tickers on the left to get started.</p>
            </div>
          ) : (
            <div className="chart-panels">
              {tickers.map((ticker, i) => (
                <ChartLoadingPanel
                  key={`pending-${ticker}`}
                  ticker={ticker}
                  color={resolveColor(ticker, i)}
                />
              ))}
            </div>
          )
        ) : (
          <>
            <KeyboardSettings
              voice={manualVoice}
              octaveShift={manualOctave}
              sustain={manualSustain}
              volume={manualVolume}
              computerKeys={computerKeys}
              showLabels={showLabels}
              onVoiceChange={setManualVoice}
              onOctaveShiftChange={setManualOctave}
              onSustainChange={setManualSustain}
              onVolumeChange={setManualVolume}
              onComputerKeysChange={handleComputerKeysChange}
              onShowLabelsChange={setShowLabels}
            />
            <PianoKeyboard
              activeNotes={activeNotes}
              trackColors={composition.tracks.map((t) => resolveColor(t.ticker, t.track))}
              onPlayNote={handlePlayManualNote}
              onStopNote={handleStopManualNote}
              showLabels={showLabels}
              externalPressed={computerPressed}
            />

            <div className="chart-panels">
              {composition.tracks.map((track) => {
                const isIndependent = independentTracks.has(track.track);
                return (
                  <TickerChartPanel
                    key={track.track}
                    ticker={track.ticker}
                    start={range.start}
                    end={range.end}
                    color={resolveColor(track.ticker, track.track)}
                    notes={composition.notes.filter((n) => n.track === track.track)}
                    notesPerBar={trackConfigs[track.ticker]?.notesPerBar || notesPerBar}
                    currentTime={isIndependent ? trackTimes[track.track] ?? currentTime : currentTime}
                    muted={getMixer(track.ticker).mute}
                    solo={getMixer(track.ticker).solo}
                    onToggleMute={() => handleTrackMixerChange(track.ticker, { mute: !getMixer(track.ticker).mute })}
                    onToggleSolo={() => handleTrackMixerChange(track.ticker, { solo: !getMixer(track.ticker).solo })}
                    onSeek={isIndependent ? (time) => handleSeekTrack(track.track, time) : handleSeek}
                    trackConfig={trackConfigs[track.ticker] || {}}
                    onTrackConfigChange={(config) => handleTrackConfigChange(track.ticker, config)}
                    trackMixer={getMixer(track.ticker)}
                    onTrackMixerChange={(partial) => handleTrackMixerChange(track.ticker, partial)}
                    independent={isIndependent}
                    onToggleIndependent={() => handleToggleIndependent(track.track)}
                    locked={lockedTracks.has(track.ticker)}
                    onToggleLock={() => handleToggleLock(track.ticker)}
                  />
                );
              })}
              {sonifyMutation.isPending &&
                tickers
                  .filter((t) => !composition.tracks.some((track) => track.ticker === t))
                  .map((ticker, i) => (
                    <ChartLoadingPanel
                      key={`pending-${ticker}`}
                      ticker={ticker}
                      color={resolveColor(ticker, composition.tracks.length + i)}
                    />
                  ))}
            </div>
          </>
        )}
      </main>

      {composition && (
        <div className="bottom-bar">
          <TransportControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            totalDuration={composition.total_duration_sec}
            volume={volume}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onVolumeChange={setVolume}
            onDownloadMidi={handleDownloadMidi}
            midiDownloadDisabled={midiMutation.isPending}
            onDownloadAudio={handleDownloadAudio}
            audioDownloadDisabled={isPlaying}
            onStopRecording={handleStopRecording}
            isRecordingAudio={isRecordingAudio}
            isLooping={isLooping}
            onToggleLoop={() => setIsLooping((prev) => !prev)}
            reverb={reverb}
            onReverbChange={setReverb}
            delay={delay}
            onDelayChange={setDelay}
          />
        </div>
      )}
    </div>
  );
}
