import { useEffect, useRef, useState } from "react";

import { useMidiExport, useSonify } from "../api/queries";
import type { ScaleName, SonifyResponse, TrackConfig } from "../api/types";
import { AudioEngine } from "../audio/AudioEngine";
import { colorForTrack } from "../audio/trackColors";
import { DateRangePicker } from "../components/DateRangePicker";
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

const TICKERS_STORAGE_KEY = "candlemusic.tickers";
const GENERATION_DEBOUNCE_MS = 500;

function loadStoredTickers(): string[] {
  try {
    const raw = localStorage.getItem(TICKERS_STORAGE_KEY);
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
  const [composition, setComposition] = useState<SonifyResponse | null>(null);
  const [volume, setVolume] = useState(80);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [customColors, setCustomColors] = useState<Record<string, string>>({});
  const [trackConfigs, setTrackConfigs] = useState<Record<string, TrackConfig>>({});

  const resolveColor = (ticker: string, trackIndex: number) => {
    return customColors[ticker] || colorForTrack(trackIndex);
  };

  const handleColorChange = (ticker: string, color: string) => {
    setCustomColors((prev) => ({ ...prev, [ticker]: color }));
  };

  const handleTrackConfigChange = (ticker: string, config: TrackConfig) => {
    setTrackConfigs((prev) => ({ ...prev, [ticker]: config }));
  };

  const audioEngineRef = useRef<AudioEngine | null>(null);
  if (audioEngineRef.current === null) {
    audioEngineRef.current = new AudioEngine();
  }
  const audioEngine = audioEngineRef.current;
  const animationRef = useRef<number | null>(null);

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
        audioEngine.pause();
        audioEngine.seek(0);
        setPlaying(false);
        setCurrentTime(0);
        if (isRecordingAudio) {
          audioEngine.stopRecording().then((blob) => {
            if (!blob) return;
            const ext = blob.type.includes("mp4") ? "mp4" : "webm";
            downloadBlob(blob, `candlemusic.${ext}`);
          });
          setIsRecordingAudio(false);
        }
        return;
      }
      setCurrentTime(t);
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, composition, setCurrentTime, setPlaying, isRecordingAudio]);

  const generationRequestRef = useRef(0);

  useEffect(() => {
    const requestId = ++generationRequestRef.current;

    if (tickers.length === 0) {
      audioEngine.dispose();
      reset();
      setComposition(null);
      return;
    }

    const timer = setTimeout(async () => {
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
          })),
          bpm: speedMode === 'bpm' ? bpm : undefined,
          total_duration_sec: speedMode === 'duration' ? totalDuration : undefined,
          notes_per_bar: notesPerBar,
          scale,
          root_note: rootNote,
          global_instrument: globalInstrument || undefined,
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
        setComposition(result);
      } catch {
        // surfaced via sonifyMutation.error
      }
    }, GENERATION_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers, range.start, range.end, scale, rootNote, notesPerBar, speedMode, bpm, totalDuration, globalInstrument, trackConfigs]);

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
    audioEngine.seek(time);
    setCurrentTime(time);
  };

  const handleDownloadMidi = () => {
    if (!composition) return;
    midiMutation.mutate({ notes: composition.notes, tracks: composition.tracks });
  };

  const handleDownloadAudio = async () => {
    if (!composition || isRecordingAudio || isPlaying) return;
    setIsRecordingAudio(true);
    audioEngine.seek(0);
    setCurrentTime(0);
    audioEngine.startRecording();
    await audioEngine.play();
    setPlaying(true);
  };

  const handleStopRecording = () => {
    audioEngine.pause();
    audioEngine.seek(0);
    setPlaying(false);
    setCurrentTime(0);
    setIsRecordingAudio(false);
    audioEngine.stopRecording().then((blob) => {
      if (!blob) return;
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      downloadBlob(blob, `candlemusic.${ext}`);
    });
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
          <h1>CandleMusic</h1>
          <p className="subtitle">Turn financial charts into music, played on a virtual piano.</p>
        </header>

        <TopMovers
          tickers={tickers}
          onAddTicker={(symbol) => {
            if (!tickers.includes(symbol)) setTickers([...tickers, symbol]);
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
            onScaleChange={setScale}
            onRootNoteChange={setRootNote}
            onNotesPerBarChange={setNotesPerBar}
            onBpmChange={setBpm}
            onTotalDurationChange={setTotalDuration}
            onSpeedModeChange={setSpeedMode}
            onGlobalInstrumentChange={setGlobalInstrument}
          />
          {sonifyMutation.isPending && <p className="status-text">Updating…</p>}
          {sonifyMutation.isError && (
            <p className="error">{(sonifyMutation.error as Error).message}</p>
          )}
        </section>
      </aside>

      <main className="main-content">
        {!composition ? (
          <div className="empty-state">
            {tickers.length === 0 ? (
              <>
                <h2>Ready to make music</h2>
                <p>Add some tickers on the left to get started.</p>
              </>
            ) : (
              <>
                <h2>Generating…</h2>
                <p>Crunching the numbers for {tickers.join(", ")}.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--text)" }}>
                <input 
                  type="checkbox" 
                  checked={showLabels} 
                  onChange={(e) => setShowLabels(e.target.checked)} 
                />
                Show Keys
              </label>
            </div>
            <PianoKeyboard
              activeNotes={activeNotes}
              trackColors={composition.tracks.map((t) => resolveColor(t.ticker, t.track))}
              onPlayNote={handlePlayManualNote}
              onStopNote={handleStopManualNote}
              showLabels={showLabels}
            />

            <div className="chart-panels">
              {composition.tracks.map((track) => (
                <TickerChartPanel
                  key={track.track}
                  ticker={track.ticker}
                  start={range.start}
                  end={range.end}
                  color={resolveColor(track.ticker, track.track)}
                  notes={composition.notes.filter((n) => n.track === track.track)}
                  notesPerBar={trackConfigs[track.ticker]?.notesPerBar || notesPerBar}
                  currentTime={currentTime}
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
          />
        </div>
      )}
    </div>
  );
}
