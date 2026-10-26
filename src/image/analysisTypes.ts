import type { AnalysisMode } from '../music/events';

export type ImagePixels = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type AnalysisOptions = {
  mode: AnalysisMode;
  targetHue: number;
  hueTolerance: number;
  minSaturation: number;
  minBrightness: number;
};