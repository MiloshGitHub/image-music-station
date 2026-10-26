import type { Feature } from '../music/events';
import type { AnalysisOptions, ImagePixels } from './analysisTypes';
import { extractColorStripes } from './colorStripes';
import { extractLineToFollow } from './lineToFollow';

export type { AnalysisOptions, ImagePixels } from './analysisTypes';

export function extractFeatures(image: ImagePixels, steps: number, options: AnalysisOptions): Feature[] {
  switch (options.mode) {
    case 'color-stripes':
      return extractColorStripes(image, steps, options);
    case 'line-to-follow':
      return extractLineToFollow(image, steps, options);
  }
}