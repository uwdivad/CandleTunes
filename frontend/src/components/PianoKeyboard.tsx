import { useMemo, useState } from "react";

const WHITE_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);
const MIN_MIDI = 36; // C2
const MAX_MIDI = 96; // C7

const WHITE_W = 22;
const WHITE_H = 120;
const BLACK_W = 13;
const BLACK_H = 76;

interface PianoKeyboardProps {
  activeNotes: Map<number, Set<number>>;
  trackColors: string[];
  onPlayNote: (midi: number) => void;
  onStopNote: (midi: number) => void;
  showLabels: boolean;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function getNoteLabel(midi: number): string {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export function PianoKeyboard({ 
  activeNotes, 
  trackColors, 
  onPlayNote, 
  onStopNote, 
  showLabels 
}: PianoKeyboardProps) {
  const [playingKeys, setPlayingKeys] = useState<Set<number>>(new Set());

  const handlePointerDown = (e: React.PointerEvent, midi: number) => {
    e.preventDefault();
    (e.target as SVGElement).setPointerCapture(e.pointerId);
    setPlayingKeys((prev) => {
      const next = new Set(prev);
      next.add(midi);
      return next;
    });
    onPlayNote(midi);
  };

  const handlePointerUp = (e: React.PointerEvent, midi: number) => {
    e.preventDefault();
    (e.target as SVGElement).releasePointerCapture(e.pointerId);
    setPlayingKeys((prev) => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
    onStopNote(midi);
  };
  const { whiteKeys, blackKeys, whiteKeyIndex } = useMemo(() => {
    const whiteKeys: number[] = [];
    const blackKeys: number[] = [];
    for (let m = MIN_MIDI; m <= MAX_MIDI; m++) {
      if (WHITE_PITCH_CLASSES.has(m % 12)) {
        whiteKeys.push(m);
      } else {
        blackKeys.push(m);
      }
    }
    const whiteKeyIndex = new Map<number, number>();
    whiteKeys.forEach((m, i) => whiteKeyIndex.set(m, i));
    return { whiteKeys, blackKeys, whiteKeyIndex };
  }, []);

  const svgWidth = whiteKeys.length * WHITE_W;

  function activeTracksFor(midi: number): number[] {
    const tracks: number[] = [];
    activeNotes.forEach((pitches, track) => {
      if (pitches.has(midi)) tracks.push(track);
    });
    return tracks.sort((a, b) => a - b);
  }

  function fillFor(midi: number, defaultFill: string): string {
    if (playingKeys.has(midi)) return "var(--accent)";
    const tracks = activeTracksFor(midi);
    if (tracks.length === 0) return defaultFill;
    if (tracks.length === 1) return trackColors[tracks[0] % trackColors.length];
    return `url(#grad-${midi})`;
  }

  function glowStyleFor(midi: number) {
    if (playingKeys.has(midi)) return { filter: `drop-shadow(0px 0px 8px var(--accent))` };
    const tracks = activeTracksFor(midi);
    if (tracks.length === 0) return {};
    const color = trackColors[tracks[0] % trackColors.length];
    return { filter: `drop-shadow(0px 0px 8px ${color})` };
  }

  const allKeys = [...whiteKeys, ...blackKeys];
  const multiActiveKeys = allKeys.filter((midi) => activeTracksFor(midi).length > 1);

  return (
    <svg
      width={svgWidth}
      height={WHITE_H}
      viewBox={`0 0 ${svgWidth} ${WHITE_H}`}
      className="piano-keyboard"
    >
      <defs>
        {multiActiveKeys.map((midi) => {
          const tracks = activeTracksFor(midi);
          const step = 100 / tracks.length;
          return (
            <linearGradient key={midi} id={`grad-${midi}`} x1="0" y1="0" x2="1" y2="0">
              {tracks.map((t, i) => (
                <stop
                  key={`${t}-start`}
                  offset={`${i * step}%`}
                  stopColor={trackColors[t % trackColors.length]}
                />
              ))}
              {tracks.map((t, i) => (
                <stop
                  key={`${t}-end`}
                  offset={`${(i + 1) * step}%`}
                  stopColor={trackColors[t % trackColors.length]}
                />
              ))}
            </linearGradient>
          );
        })}
      </defs>

      {whiteKeys.map((midi) => {
        const idx = whiteKeyIndex.get(midi)!;
        return (
          <g key={midi}>
            <rect
              x={idx * WHITE_W}
              y={0}
              width={WHITE_W - 1}
              height={WHITE_H}
              fill={fillFor(midi, "#fafafa")}
              stroke="#999"
              strokeWidth={1}
              className="piano-key piano-key-white"
              style={{ ...glowStyleFor(midi), cursor: "pointer", touchAction: "none" }}
              onPointerDown={(e) => handlePointerDown(e, midi)}
              onPointerUp={(e) => handlePointerUp(e, midi)}
              onPointerCancel={(e) => handlePointerUp(e, midi)}
            />
            {showLabels && (
              <text
                x={idx * WHITE_W + WHITE_W / 2}
                y={WHITE_H - 12}
                textAnchor="middle"
                fill="#666"
                fontSize="10"
                pointerEvents="none"
              >
                {getNoteLabel(midi)}
              </text>
            )}
          </g>
        );
      })}

      {blackKeys.map((midi) => {
        const precedingWhite = whiteKeyIndex.get(midi - 1)!;
        const x = (precedingWhite + 1) * WHITE_W - BLACK_W / 2;
        return (
          <g key={midi}>
            <rect
              x={x}
              y={0}
              width={BLACK_W}
              height={BLACK_H}
              fill={fillFor(midi, "#1a1a1a")}
              className="piano-key piano-key-black"
              style={{ ...glowStyleFor(midi), cursor: "pointer", touchAction: "none" }}
              onPointerDown={(e) => handlePointerDown(e, midi)}
              onPointerUp={(e) => handlePointerUp(e, midi)}
              onPointerCancel={(e) => handlePointerUp(e, midi)}
            />
            {showLabels && (
              <text
                x={x + BLACK_W / 2}
                y={BLACK_H - 12}
                textAnchor="middle"
                fill="#aaa"
                fontSize="8"
                pointerEvents="none"
              >
                {getNoteLabel(midi)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
