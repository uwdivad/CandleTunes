export const TRACK_COLORS = [
  "#4f9dde", // blue
  "#e07a5f", // terracotta
  "#81b29a", // sage
  "#f2cc8f", // sand
  "#9b5de5", // violet
  "#ff007f", // neon pink
  "#00f3ff", // neon cyan
  "#39ff14", // neon green
];

export function colorForTrack(trackIndex: number): string {
  return TRACK_COLORS[trackIndex % TRACK_COLORS.length];
}
