import { create } from "zustand";

interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  activeNotes: Map<number, Set<number>>;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setTotalDuration: (duration: number) => void;
  noteOn: (track: number, pitch: number) => void;
  noteOff: (track: number, pitch: number) => void;
  reset: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  isPlaying: false,
  currentTime: 0,
  totalDuration: 0,
  activeNotes: new Map(),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setTotalDuration: (duration) => set({ totalDuration: duration }),
  noteOn: (track, pitch) =>
    set((state) => {
      const next = new Map(state.activeNotes);
      const set_ = new Set(next.get(track) ?? []);
      set_.add(pitch);
      next.set(track, set_);
      return { activeNotes: next };
    }),
  noteOff: (track, pitch) =>
    set((state) => {
      const next = new Map(state.activeNotes);
      const set_ = new Set(next.get(track) ?? []);
      set_.delete(pitch);
      next.set(track, set_);
      return { activeNotes: next };
    }),
  reset: () =>
    set({ isPlaying: false, currentTime: 0, activeNotes: new Map() }),
}));
