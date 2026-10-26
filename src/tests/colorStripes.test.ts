import { describe, expect, it } from 'vitest';
import { extractColorStripes } from '../image/colorStripes';
import { extractLineToFollow } from '../image/lineToFollow';

describe('extractColorStripes', () => {
  it('returns exactly the requested number of steps', () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255; pixels[i + 1] = 0; pixels[i + 2] = 0; pixels[i + 3] = 255;
    }
    expect(extractColorStripes({ data: pixels, width: 4, height: 4 }, 16)).toHaveLength(16);
  });

  it('handles hue wrap-around without producing an invalid hue', () => {
    const pixels = new Uint8ClampedArray(2 * 2 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255; pixels[i + 1] = 2; pixels[i + 2] = 0; pixels[i + 3] = 255;
    }
    const features = extractColorStripes({ data: pixels, width: 2, height: 2 }, 2);
    for (const f of features) expect(f.hue).toBeGreaterThanOrEqual(0);
    for (const f of features) expect(f.hue).toBeLessThan(360);
  });

  it('measures bottom-relative line position, area, and rising tangent per stripe', () => {
    const width = 40, height = 40;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let x = 0; x < width; x++) {
      const y = 34 - Math.floor(x * 0.6);
      const index = (y * width + x) * 4;
      pixels[index] = 255;
      pixels[index + 3] = 255;
    }

    const features = extractLineToFollow({ data: pixels, width, height }, 4, {
      mode: 'line-to-follow', targetHue: 0, hueTolerance: 15, minSaturation: 0.5, minBrightness: 0.1,
    });

    expect(features.every(feature => feature.lineFound)).toBe(true);
    expect(features[3].linePosition).toBeGreaterThan(features[0].linePosition ?? 0);
    expect(features[3].lineArea).toBeGreaterThan(features[0].lineArea ?? 0);
    expect(features.every(feature => (feature.lineTangent ?? 0) > 0.5)).toBe(true);
  });
});