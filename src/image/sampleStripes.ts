import type { Feature } from '../music/events';
import type { AnalysisOptions, ImagePixels } from './analysisTypes';
import { average, matchesTarget, meanHue, readColorSample } from './colorMath';

export type SampledStripe = {
  step: number;
  count: number;
  x0: number;
  x1: number;
  width: number;
  height: number;
  columns: { x: number; samples: ReturnType<typeof readColorSample>[] }[];
  samples: ReturnType<typeof readColorSample>[];
};

export function sampleImageStripes(image: ImagePixels, steps: number, fullVerticalResolution = false): SampledStripe[] {
  const count = Math.max(1, Math.min(64, Math.floor(steps)));
  const xStride = Math.max(1, Math.floor(image.width / count / 16));
  const yStride = fullVerticalResolution ? 1 : Math.max(1, Math.floor(image.height / 96));

  return Array.from({ length: count }, (_, step) => {
    const x0 = Math.floor(step * image.width / count);
    const x1 = Math.max(x0 + 1, Math.floor((step + 1) * image.width / count));
    const columns: SampledStripe['columns'] = [];
    const samples: SampledStripe['samples'] = [];

    for (let x = x0; x < Math.min(image.width, x1); x += xStride) {
      const columnSamples = [];
      for (let y = 0; y < image.height; y += yStride) {
        const sample = readColorSample(image.data, (y * image.width + x) * 4, x, y);
        columnSamples.push(sample);
        samples.push(sample);
      }
      columns.push({ x, samples: columnSamples });
    }

    return { step, count, x0, x1, width: image.width, height: image.height, columns, samples };
  });
}

export function summarizeStripe(stripe: SampledStripe, options: AnalysisOptions): Feature {
  const samples = stripe.samples;
  const edges: number[] = [];
  const rows = stripe.columns[0]?.samples.length ?? 0;
  const matches = samples.filter(sample => matchesTarget(sample, options));

  for (let row = 0; row < rows; row += 1) {
    for (let column = 1; column < stripe.columns.length; column += 1) {
      edges.push(Math.abs(stripe.columns[column].samples[row].brightness - stripe.columns[column - 1].samples[row].brightness));
    }
  }

  return {
    step: stripe.step,
    hue: meanHue(samples.map(sample => sample.hue)),
    brightness: average(samples.map(sample => sample.brightness)),
    saturation: average(samples.map(sample => sample.saturation)),
    edge: average(edges),
    position: matches.length
      ? average(matches.map(sample => sample.x)) / Math.max(1, stripe.width - 1)
      : stripe.step / Math.max(1, stripe.count - 1),
    objectSize: matches.length
      ? Math.max(
        Math.max(...matches.map(sample => sample.x)) - Math.min(...matches.map(sample => sample.x)) + 1,
        Math.max(...matches.map(sample => sample.y)) - Math.min(...matches.map(sample => sample.y)) + 1,
      ) / Math.max(stripe.width, stripe.height)
      : 0,
    objectFound: matches.length > 0,
  };
}