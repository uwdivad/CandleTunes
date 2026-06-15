interface TransportControlsProps {
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  volume: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onDownloadMidi: () => void;
  midiDownloadDisabled: boolean;
  onDownloadAudio: () => void;
  audioDownloadDisabled: boolean;
  onStopRecording: () => void;
  isRecordingAudio: boolean;
  isLooping: boolean;
  onToggleLoop: () => void;
  reverb: number;
  onReverbChange: (reverb: number) => void;
  delay: number;
  onDelayChange: (delay: number) => void;
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
  volume,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onDownloadMidi,
  midiDownloadDisabled,
  onDownloadAudio,
  audioDownloadDisabled,
  onStopRecording,
  isRecordingAudio,
  isLooping,
  onToggleLoop,
  reverb,
  onReverbChange,
  delay,
  onDelayChange,
}: TransportControlsProps) {
  return (
    <div className="transport-controls">
      <button type="button" className="play-pause-btn" onClick={onPlayPause} disabled={isRecordingAudio}>
        {isPlaying ? "Pause" : "Play"}
      </button>

      <button
        type="button"
        className={`loop-btn ${isLooping ? "active" : ""}`}
        onClick={onToggleLoop}
        disabled={isRecordingAudio}
        aria-pressed={isLooping}
        title="Loop playback"
      >
        🔁
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
        disabled={isRecordingAudio}
      />
      <span className="time-label">{formatTime(totalDuration)}</span>

      <div className="volume-control">
        <span className="volume-icon" aria-hidden="true">
          {volume === 0 ? "🔇" : "🔊"}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="volume-bar"
          aria-label="Volume"
        />
      </div>

      <div className="volume-control" title="Reverb">
        <span className="volume-icon" aria-hidden="true">🌊</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={reverb}
          onChange={(e) => onReverbChange(Number(e.target.value))}
          className="volume-bar"
          aria-label="Reverb"
        />
      </div>

      <div className="volume-control" title="Delay">
        <span className="volume-icon" aria-hidden="true">🔂</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={delay}
          onChange={(e) => onDelayChange(Number(e.target.value))}
          className="volume-bar"
          aria-label="Delay"
        />
      </div>

      <button type="button" onClick={onDownloadMidi} disabled={midiDownloadDisabled}>
        Download MIDI
      </button>
      {isRecordingAudio ? (
        <button type="button" className="recording-btn" onClick={onStopRecording}>
          Stop Recording ({formatTime(currentTime)})
        </button>
      ) : (
        <button type="button" onClick={onDownloadAudio} disabled={audioDownloadDisabled}>
          Download Audio
        </button>
      )}
    </div>
  );
}
