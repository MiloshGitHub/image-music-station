import { describe, expect, it } from 'vitest';
import { quantizeToScale } from '../music/scales';
import { mapFeaturesToEvents } from '../music/mapFeatures';
import type { Feature } from '../music/events';

describe('quantizeToScale', () => {
  it('keeps notes inside the requested range', () => {
    const note = quantizeToScale(55, 36, 'Minor', 28, 55);
    expect(note).toBeGreaterThanOrEqual(28);
    expect(note).toBeLessThanOrEqual(55);
  });

  it('quantizes to the selected minor scale', () => {
    const note = quantizeToScale(49, 36, 'Minor', 36, 60);
    expect([0, 2, 3, 5, 7, 8, 10]).toContain((note - 36) % 12);
  });
});

describe('mapFeaturesToEvents', () => {
  it('makes one event per step and keeps duration separate from pitch source', () => {
    const features: Feature[] = [
      { step: 0, hue: 0, brightness: 0.2, saturation: 0.8 },
      { step: 1, hue: 220, brightness: 0.9, saturation: 0.1 },
    ];
    const settings = { pitchSource: 'hue' as const, durationSource: 'brightness' as const, rootMidi: 36, scale: 'Chromatic', minMidi: 36, maxMidi: 72, threshold: 0, steps: 2, stepBeats: 0.25 };
    const events = mapFeaturesToEvents(features, settings);
    expect(events).toHaveLength(2);
    expect(events[0].duration).not.toBe(events[1].duration);
    expect(events[0].pitch).not.toBe(events[1].pitch);
  });

  it('scales note duration with the selected step subdivision', () => {
    const feature: Feature[] = [{ step: 0, hue: 120, brightness: 0.5, saturation: 0.5 }];
    const settings = { pitchSource: 'hue' as const, durationSource: 'fixed' as const, rootMidi: 36, scale: 'Chromatic', minMidi: 36, maxMidi: 72, threshold: 0, steps: 1, stepBeats: 0.25 };
    const sixteenth = mapFeaturesToEvents(feature, settings)[0];
    const eighth = mapFeaturesToEvents(feature, { ...settings, stepBeats: 0.5 })[0];

    expect(eighth.duration).toBe(sixteenth.duration * 2);
  });

  it('maps line position, area, and tangent independently', () => {
    const feature: Feature[] = [{
      step: 0, hue: 0, brightness: 0, saturation: 0,
      linePosition: 0.25, lineArea: 0.5, lineTangent: 0.75, lineFound: true,
    }];
    const settings = {
      pitchSource: 'line-position' as const,
      durationSource: 'line-area' as const,
      volumeSource: 'line-tangent' as const,
      analysisMode: 'line-to-follow' as const,
      rootMidi: 36, scale: 'Chromatic', minMidi: 36, maxMidi: 72,
      threshold: 100, steps: 1, stepBeats: 0.25,
    };
    const [event] = mapFeaturesToEvents(feature, settings);

    expect(event.pitch).toBe(45);
    expect(event.duration).toBeCloseTo(0.25 * (0.12 + 0.5 * 0.84));
    expect(event.velocity).toBeCloseTo(0.05 + 0.75 * 0.95);
    expect(event.active).toBe(true);
    expect(mapFeaturesToEvents([{ ...feature[0], lineFound: false }], settings)[0].active).toBe(false);
  });
});