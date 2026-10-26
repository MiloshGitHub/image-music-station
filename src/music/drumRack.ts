import type { DrumChannel, DrumHit, DrumPattern } from './events';
import type { ImagePixels } from '../image/analysis';

const CHANNEL_COUNT = 16;
const DEFAULT_STEPS = 16;
const CHANNEL_NAMES = [
  'Kick', 'Sub Kick', 'Snare', 'Clap',
  'Closed Hat', 'Open Hat', 'Rim', 'Tom Low',
  'Tom Mid', 'Tom High', 'Shaker', 'Perc 1',
  'Perc 2', 'Ride', 'Crash', 'Fx',
] as const;

type ChannelBucket = {
  hits: number;
  hueSum: number;
};

type StepBucket = {
  count: number;
  velocitySum: number;
};

function hslColor(hue: number, saturation = 78, lightness = 56) {
  return `hsl(${Math.round(hue)} ${saturation}% ${lightness}%)`;
}

function newStepBuckets(steps: number): StepBucket[] {
  return Array.from({ length: steps }, () => ({ count: 0, velocitySum: 0 }));
}

export function createEmptyDrumPattern(steps = DEFAULT_STEPS): DrumPattern {
  const safeSteps = Math.max(1, Math.round(steps));
  const channels: DrumChannel[] = Array.from({ length: CHANNEL_COUNT }, (_, index) => ({
    index,
    name: CHANNEL_NAMES[index],
    color: hslColor((index / CHANNEL_COUNT) * 360),
    hits: 0,
  }));
  const hits: DrumHit[] = [];
  for (let channel = 0; channel < CHANNEL_COUNT; channel += 1) {
    for (let step = 0; step < safeSteps; step += 1) {
      hits.push({ channel, step, active: false, velocity: 0.45 });
    }
  }
  return { steps: safeSteps, channels, hits };
}

export const DEFAULT_DRUM_THRESHOLD = 40;

// threshold (0-100): higher = only strong, saturated, dominant colors trigger hits
export function analyzeImageToDrumPattern(image: ImagePixels, steps: number, threshold = DEFAULT_DRUM_THRESHOLD): DrumPattern {
  const level = Math.max(0, Math.min(100, threshold)) / 100;
  const minSaturation = 0.08 + level * 0.5;
  const safeSteps = Math.max(1, Math.round(steps));
  const channels: DrumChannel[] = Array.from({ length: CHANNEL_COUNT }, (_, index) => ({
    index,
    name: CHANNEL_NAMES[index],
    color: hslColor((index / CHANNEL_COUNT) * 360),
    hits: 0,
  }));
  const channelStats: ChannelBucket[] = Array.from({ length: CHANNEL_COUNT }, () => ({ hits: 0, hueSum: 0 }));
  const buckets = Array.from({ length: CHANNEL_COUNT }, () => newStepBuckets(safeSteps));
  const { data, width, height } = image;
  const pixelStride = Math.max(1, Math.floor(Math.max(width, height) / 240));
  const stepWidth = Math.max(1, width - 1);

  for (let y = 0; y < height; y += pixelStride) {
    for (let x = 0; x < width; x += pixelStride) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3] / 255;
      if (alpha < 0.2) continue;
      const red = data[index] / 255;
      const green = data[index + 1] / 255;
      const blue = data[index + 2] / 255;
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const delta = maximum - minimum;
      if (delta < 0.08 || maximum < 0.1) continue;
      if (delta / maximum < minSaturation || maximum < 0.1 + level * 0.25) continue;
      let hue = 0;
      if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
      else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
      else hue = 60 * ((red - green) / delta + 4);
      if (hue < 0) hue += 360;
      const channel = Math.min(CHANNEL_COUNT - 1, Math.floor((hue / 360) * CHANNEL_COUNT));
      const step = Math.min(safeSteps - 1, Math.floor((x / stepWidth) * safeSteps));
      const saturation = maximum === 0 ? 0 : delta / maximum;
      const brightness = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      const velocity = Math.max(0.18, Math.min(1, saturation * 0.62 + brightness * 0.72));
      buckets[channel][step].count += 1;
      buckets[channel][step].velocitySum += velocity;
      channelStats[channel].hits += 1;
      channelStats[channel].hueSum += hue;
    }
  }

  const globalMax = buckets.reduce((top, row) => Math.max(top, ...row.map(item => item.count)), 0);
  const hits: DrumHit[] = [];
  for (let channel = 0; channel < CHANNEL_COUNT; channel += 1) {
    const stats = channelStats[channel];
    const averageHue = stats.hits ? stats.hueSum / stats.hits : (channel / CHANNEL_COUNT) * 360;
    channels[channel] = {
      ...channels[channel],
      color: hslColor(averageHue),
      hits: stats.hits,
    };
    const row = buckets[channel];
    const maxCount = row.reduce((result, item) => Math.max(result, item.count), 0);
    const activationThreshold = Math.max(1, Math.round(Math.max(maxCount * (0.1 + level * 0.8), globalMax * level * 0.4)));
    for (let step = 0; step < safeSteps; step += 1) {
      const cell = row[step];
      const active = cell.count >= activationThreshold && cell.count > 0;
      const velocity = cell.count ? Math.max(0.2, Math.min(1, cell.velocitySum / cell.count)) : 0.42;
      hits.push({ channel, step, active, velocity });
    }
  }

  return { steps: safeSteps, channels, hits };
}
