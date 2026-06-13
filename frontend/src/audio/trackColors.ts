export const TRACK_COLORS = [
  "#4f9dde", // track 0 (piano) - blue
  "#e07a5f", // track 1 - terracotta
  "#81b29a", // track 2 - sage
  "#f2cc8f", // track 3 - sand
  "#9b5de5", // track 4 - violet
];

export function colorForTrack(trackIndex: number): string {
  return TRACK_COLORS[trackIndex % TRACK_COLORS.length];
}
