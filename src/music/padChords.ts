import type { ImagePixels } from '../image/analysisTypes';
import { readColorSample } from '../image/colorMath';
import { SCALES } from './scales';
import type { PadChord } from './events';

export type PadSettings = {
  rootMidi: number;
  scale: string;
  baseBars: number;
  sensitivity: number;
};

type Segment = { hue: number; saturation: number; brightness: number; colorful: boolean };

function hslColor(hue: number, saturation: number, brightness: number) {
  return `hsl(${Math.round(hue)} ${Math.round(40 + saturation * 50)}% ${Math.round(30 + brightness * 40)}%)`;
}

// Dominant hue of a pixel region, weighted by saturation, plus average saturation / brightness.
export function analyzeRegion(image: ImagePixels, x0: number, x1: number, minSaturation: number): Segment {
  const bins = new Array(36).fill(0);
  let saturationSum = 0;
  let brightnessSum = 0;
  let count = 0;
  let colorWeight = 0;
  const stride = Math.max(1, Math.floor(Math.max(image.width, image.height) / 160));
  for (let y = 0; y < image.height; y += stride) {
    for (let x = x0; x < x1; x += stride) {
      const index = (y * image.width + x) * 4;
      if (image.data[index + 3] < 50) continue;
      const sample = readColorSample(image.data, index, x, y);
      brightnessSum += sample.brightness;
      saturationSum += sample.saturation;
      count += 1;
      if (sample.saturation >= minSaturation && sample.brightness > 0.12) {
        const weight = sample.saturation * sample.brightness;
        bins[Math.min(35, Math.floor(sample.hue / 10))] += weight;
        colorWeight += weight;
      }
    }
  }
  const total = Math.max(1, count);
  let best = 0;
  bins.forEach((value, index) => { if (value > bins[best]) best = index; });
  return {
    hue: best * 10 + 5,
    saturation: saturationSum / total,
    brightness: brightnessSum / total,
    colorful: colorWeight > 0,
  };
}

function chordFromSegment(segment: Segment, settings: PadSettings) {
  const intervals = SCALES[settings.scale] ?? SCALES.Minor;
  const degree = segment.colorful ? Math.min(intervals.length - 1, Math.floor((segment.hue / 360) * intervals.length)) : 0;
  const stack = segment.saturation > 0.65 ? 5 : segment.saturation > 0.3 ? 4 : 3;
  const octave = segment.brightness > 0.6 ? 1 : 0;
  const notes: number[] = [];
  for (let i = 0; i < stack; i += 1) {
    const d = degree + i * 2;
    const note = settings.rootMidi + 12 + octave * 12 + intervals[d % intervals.length] + Math.floor(d / intervals.length) * 12;
    notes.push(note);
  }
  // Keep the voicing compact by folding notes above the range down an octave.
  const ceiling = settings.rootMidi + 12 + octave * 12 + 19;
  const voiced = notes.map(note => (note > ceiling ? note - 12 : note)).sort((a, b) => a - b);
  return { degree, notes: Array.from(new Set(voiced)) };
}

function toChords(segments: Segment[], settings: PadSettings): PadChord[] {
  const chords: PadChord[] = [];
  segments.forEach(segment => {
    const { degree, notes } = chordFromSegment(segment, settings);
    // Darker sections hold longer.
    const bars = settings.baseBars * (segment.brightness < 0.35 ? 2 : 1);
    const previous = chords[chords.length - 1];
    if (previous && previous.degree === degree) {
      previous.bars += bars;
      return;
    }
    chords.push({
      index: chords.length,
      degree,
      notes,
      bars,
      velocity: Math.max(0.25, Math.min(0.9, 0.3 + segment.brightness * 0.6)),
      color: hslColor(segment.hue, segment.saturation, segment.brightness),
    });
  });
  return chords;
}

export function imageToPadChords(image: ImagePixels, sections: number, settings: PadSettings): PadChord[] {
  const minSaturation = 0.08 + (settings.sensitivity / 100) * 0.5;
  const segments: Segment[] = [];
  for (let i = 0; i < sections; i += 1) {
    const x0 = Math.floor((i / sections) * image.width);
    const x1 = Math.max(x0 + 1, Math.floor(((i + 1) / sections) * image.width));
    segments.push(analyzeRegion(image, x0, x1, minSaturation));
  }
  return toChords(segments, settings);
}

export function framesToPadChords(frames: ImagePixels[], settings: PadSettings): PadChord[] {
  const minSaturation = 0.08 + (settings.sensitivity / 100) * 0.5;
  return toChords(frames.map(frame => analyzeRegion(frame, 0, frame.width, minSaturation)), settings);
}
