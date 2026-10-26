import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DRUM_SAMPLE_PATHS,
  DRUM_SAMPLE_OPTIONS,
  getDrumSampleCategory,
} from '../music/drumSamples';

describe('drum sample selection', () => {
  it('lists every bundled sample under its instrument folder', () => {
    const samples = Object.entries(DRUM_SAMPLE_OPTIONS).flatMap(([category, options]) =>
      options.map(option => ({ category, ...option })),
    );

    expect(samples).toHaveLength(73);
    expect(samples.every(sample => sample.url.startsWith(`/drums/${sample.category}/`))).toBe(true);
    expect(new Set(samples.map(sample => sample.url)).size).toBe(samples.length);
  });

  it('provides a valid default sample for each of the 16 channels', () => {
    expect(DEFAULT_DRUM_SAMPLE_PATHS).toHaveLength(16);
    DEFAULT_DRUM_SAMPLE_PATHS.forEach((url, channel) => {
      const category = getDrumSampleCategory(channel);
      expect(DRUM_SAMPLE_OPTIONS[category].some(sample => sample.url === url)).toBe(true);
    });
  });

  it('filters the rack rows by their drum role', () => {
    expect(getDrumSampleCategory(0)).toBe('kicks');
    expect(getDrumSampleCategory(1)).toBe('kicks');
    expect(getDrumSampleCategory(2)).toBe('snares');
    expect(getDrumSampleCategory(3)).toBe('claps');
    expect(getDrumSampleCategory(4)).toBe('hats');
    expect(getDrumSampleCategory(13)).toBe('cymbals');
    expect(getDrumSampleCategory(15)).toBe('fx');
  });
});
