interface TransportControlsProps {
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onDownloadMidi: () => void;
  midiDownloadDisabled: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TransportControls({
  isPlaying,
  currentTime,
  totalDuration,
  onPlayPause,
  onSeek,
  onDownloadMidi,
  midiDownloadDisabled,
}: TransportControlsProps) {
  return (
    <div className="transport-controls">
      <button type="button" className="play-pause-btn" onClick={onPlayPause}>
        {isPlaying ? "Pause" : "Play"}
      </button>

      <span className="time-label">{formatTime(currentTime)}</span>
      <input
        type="range"
        min={0}
        max={totalDuration}
        step={0.1}
        value={Math.min(currentTime, totalDuration)}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="seek-bar"
      />
      <span className="time-label">{formatTime(totalDuration)}</span>

      <button type="button" onClick={onDownloadMidi} disabled={midiDownloadDisabled}>
        Download MIDI
      </button>
    </div>
  );
}
