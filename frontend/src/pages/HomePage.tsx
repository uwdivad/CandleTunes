import { useEffect, useRef, useState } from "react";

import { useMidiExport, useSonify } from "../api/queries";
import type { ScaleName, SonifyResponse } from "../api/types";
import { AudioEngine } from "../audio/AudioEngine";
import { colorForTrack } from "../audio/trackColors";
import { DateRangePicker } from "../components/DateRangePicker";
import { PianoKeyboard } from "../components/PianoKeyboard";
import { SonifyControls } from "../components/SonifyControls";
import { TickerChartPanel } from "../components/TickerChartPanel";
import { TickerInput } from "../components/TickerInput";
import { TransportControls } from "../components/TransportControls";
import { usePlaybackStore } from "../state/playbackStore";

function defaultDates() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 12);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function HomePage() {
  const [tickers, setTickers] = useState<string[]>(["AAPL"]);
  const [range, setRange] = useState(defaultDates());
  const [scale, setScale] = useState<ScaleName>("major");
  const [rootNote, setRootNote] = useState(0);
  const [notesPerBar, setNotesPerBar] = useState<1 | 2>(1);
  const [totalDuration, setTotalDuration] = useState(60);
  const [composition, setComposition] = useState<SonifyResponse | null>(null);

  const audioEngineRef = useRef<AudioEngine>(new AudioEngine());
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
  const reset = usePlaybackStore((s) => s.reset);

  useEffect(() => {
    return () => {
      audioEngineRef.current.dispose();
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      return;
    }

    const tick = () => {
      const t = audioEngineRef.current.getCurrentTime();
      if (composition && t >= composition.total_duration_sec) {
        audioEngineRef.current.pause();
        audioEngineRef.current.seek(0);
        setPlaying(false);
        setCurrentTime(0);
        return;
      }
      setCurrentTime(t);
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, composition, setCurrentTime, setPlaying]);

  const handleGenerate = async () => {
    reset();
    setComposition(null);
    const result = await sonifyMutation.mutateAsync({
      tracks: tickers.map((ticker) => ({ ticker, start: range.start, end: range.end })),
      total_duration_sec: totalDuration,
      notes_per_bar: notesPerBar,
      scale,
      root_note: rootNote,
    });
    setComposition(result);
    await audioEngineRef.current.init(result.tracks);
    audioEngineRef.current.schedule(
      result.notes,
      (note) => noteOn(note.track, note.pitch_midi),
      (note) => noteOff(note.track, note.pitch_midi)
    );
  };

  const handlePlayPause = async () => {
    if (!composition) return;
    if (isPlaying) {
      audioEngineRef.current.pause();
      setPlaying(false);
    } else {
      await audioEngineRef.current.play();
      setPlaying(true);
    }
  };

  const handleSeek = (time: number) => {
    audioEngineRef.current.seek(time);
    setCurrentTime(time);
  };

  const handleDownloadMidi = () => {
    if (!composition) return;
    midiMutation.mutate({ notes: composition.notes, tracks: composition.tracks });
  };

  return (
    <div className="home-page">
      <header>
        <h1>CandleMusic</h1>
        <p className="subtitle">Turn financial charts into music, played on a virtual piano.</p>
      </header>

      <section className="controls">
        <TickerInput tickers={tickers} onChange={setTickers} colorForTrack={colorForTrack} />
        <DateRangePicker
          start={range.start}
          end={range.end}
          onChange={(start, end) => setRange({ start, end })}
        />
        <SonifyControls
          scale={scale}
          rootNote={rootNote}
          notesPerBar={notesPerBar}
          totalDuration={totalDuration}
          onScaleChange={setScale}
          onRootNoteChange={setRootNote}
          onNotesPerBarChange={setNotesPerBar}
          onTotalDurationChange={setTotalDuration}
        />
        <button
          type="button"
          className="generate-btn"
          onClick={handleGenerate}
          disabled={sonifyMutation.isPending || tickers.length === 0}
        >
          {sonifyMutation.isPending ? "Generating…" : "Generate"}
        </button>
        {sonifyMutation.isError && (
          <p className="error">{(sonifyMutation.error as Error).message}</p>
        )}
      </section>

      {composition && (
        <>
          <TransportControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            totalDuration={composition.total_duration_sec}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onDownloadMidi={handleDownloadMidi}
            midiDownloadDisabled={midiMutation.isPending}
          />

          <PianoKeyboard
            activeNotes={activeNotes}
            trackColors={composition.tracks.map((t) => colorForTrack(t.track))}
          />

          <div className="chart-panels">
            {composition.tracks.map((track) => (
              <TickerChartPanel
                key={track.track}
                ticker={track.ticker}
                start={range.start}
                end={range.end}
                color={colorForTrack(track.track)}
                notes={composition.notes.filter((n) => n.track === track.track)}
                notesPerBar={notesPerBar}
                currentTime={currentTime}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
