interface ChartLoadingPanelProps {
  ticker: string;
  /** Track color, used to tint the keys as they "press" down. */
  color: string;
}

// Geometry for the little piano: 7 white keys (C–B) with black keys sitting on
// the gaps after C, D, F, G, A. Positions are computed so the absolutely-placed
// black keys line up with the flex-laid white keys.
const WHITE_KEYS = 7;
const WHITE_W = 24;
const WHITE_GAP = 2;
const PAD = 8;
const BLACK_W = 15;
const BLACK_AFTER = [0, 1, 3, 4, 5];
const PRESS_STAGGER = 0.12;

export function ChartLoadingPanel({ ticker, color }: ChartLoadingPanelProps) {
  return (
    <div
      className="chart-panel chart-loading-panel"
      style={{ ["--key-accent" as string]: color }}
    >
      <div className="chart-loading-keys">
        {Array.from({ length: WHITE_KEYS }).map((_, i) => (
          <span
            key={`w${i}`}
            className="chart-loading-key chart-loading-key-white"
            style={{ animationDelay: `${i * PRESS_STAGGER}s` }}
          />
        ))}
        {BLACK_AFTER.map((i) => {
          const center = PAD + i * (WHITE_W + WHITE_GAP) + WHITE_W + WHITE_GAP / 2;
          return (
            <span
              key={`b${i}`}
              className="chart-loading-key chart-loading-key-black"
              style={{
                left: center - BLACK_W / 2,
                animationDelay: `${i * PRESS_STAGGER + PRESS_STAGGER / 2}s`,
              }}
            />
          );
        })}
      </div>
      <p className="chart-loading-label">Composing {ticker}…</p>
    </div>
  );
}
