export const SCALES: Record<string, number[]> = {
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Pentatonic: [0, 2, 4, 7, 9],
  'Minor Pentatonic': [0, 3, 5, 7, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
};

export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export function midiName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function quantizeToScale(target: number, rootMidi: number, scaleName: string, minMidi: number, maxMidi: number): number {
  const intervals = SCALES[scaleName] ?? SCALES.Minor;
  const candidates: number[] = [];
  for (let note = Math.max(0, minMidi); note <= Math.min(127, maxMidi); note++) {
    const interval = ((note - rootMidi) % 12 + 12) % 12;
    if (intervals.includes(interval)) candidates.push(note);
  }
  if (!candidates.length) return Math.max(0, Math.min(127, Math.round(target)));
  return candidates.reduce((best, n) => Math.abs(n - target) < Math.abs(best - target) ? n : best, candidates[0]);
}