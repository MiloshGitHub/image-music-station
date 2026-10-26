import { useSyncExternalStore } from 'react';

// Minimal external store so a fast-moving playhead re-renders only the components that read it.
export type Playhead = {
  get: () => number;
  set: (value: number) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createPlayhead(initial = 0): Playhead {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: next => {
      if (next === value) return;
      value = next;
      listeners.forEach(listener => listener());
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export function usePlayhead(playhead: Playhead) {
  return useSyncExternalStore(playhead.subscribe, playhead.get);
}
