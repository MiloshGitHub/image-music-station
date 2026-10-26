import type { AnalysisOptions } from './analysisTypes';

export type ColorSample = {
  x: number;
  y: number;
  hue: number;
  saturation: number;
  brightness: number;
};

export function readColorSample(image: Uint8ClampedArray, index: number, x: number, y: number): ColorSample {
  const red = image[index] / 255;
  const green = image[index + 1] / 255;
  const blue = image[index + 2] / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;

  return {
    x,
    y,
    hue,
    saturation: maximum === 0 ? 0 : delta / maximum,
    brightness: 0.2126 * red + 0.7152 * green + 0.0722 * blue,
  };
}

export function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

export function meanHue(hues: number[]) {
  if (!hues.length) return 0;
  const x = hues.reduce((sum, hue) => sum + Math.cos(hue * Math.PI / 180), 0);
  const y = hues.reduce((sum, hue) => sum + Math.sin(hue * Math.PI / 180), 0);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function hueDistance(first: number, second: number) {
  return Math.abs(((first - second + 540) % 360) - 180);
}

export function matchesTarget(sample: ColorSample, options: AnalysisOptions) {
  return sample.saturation >= options.minSaturation
    && sample.brightness >= options.minBrightness
    && hueDistance(sample.hue, options.targetHue) <= options.hueTolerance;
}

export function clampUnit(value: number) {
  return Math.max(0, Math.min(1, value));
}