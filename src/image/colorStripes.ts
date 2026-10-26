import type { Feature } from '../music/events';
import type { AnalysisOptions, ImagePixels } from './analysisTypes';
import { sampleImageStripes, summarizeStripe } from './sampleStripes';

export function extractColorStripes(image: ImagePixels, steps: number, optionsOrThreshold: AnalysisOptions | number = 0): Feature[] {
  const options: AnalysisOptions = typeof optionsOrThreshold === 'number'
    ? { mode: 'color-stripes', targetHue: 180, hueTolerance: 25, minSaturation: 0, minBrightness: optionsOrThreshold / 100 }
    : optionsOrThreshold;
  return sampleImageStripes(image, steps).map(stripe => summarizeStripe(stripe, options));
}