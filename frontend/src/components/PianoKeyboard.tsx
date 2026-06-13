import { useMemo } from "react";

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
}

export function PianoKeyboard({ activeNotes, trackColors }: PianoKeyboardProps) {
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
    const tracks = activeTracksFor(midi);
    if (tracks.length === 0) return defaultFill;
    if (tracks.length === 1) return trackColors[tracks[0] % trackColors.length];
    return `url(#grad-${midi})`;
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
          <rect
            key={midi}
            x={idx * WHITE_W}
            y={0}
            width={WHITE_W - 1}
            height={WHITE_H}
            fill={fillFor(midi, "#fafafa")}
            stroke="#999"
            strokeWidth={1}
            className="piano-key piano-key-white"
          />
        );
      })}

      {blackKeys.map((midi) => {
        const precedingWhite = whiteKeyIndex.get(midi - 1)!;
        const x = (precedingWhite + 1) * WHITE_W - BLACK_W / 2;
        return (
          <rect
            key={midi}
            x={x}
            y={0}
            width={BLACK_W}
            height={BLACK_H}
            fill={fillFor(midi, "#1a1a1a")}
            className="piano-key piano-key-black"
          />
        );
      })}
    </svg>
  );
}
