import type { Feature } from '../music/events';
import type { AnalysisOptions, ImagePixels } from './analysisTypes';
import { average, clampUnit, matchesTarget } from './colorMath';
import { sampleImageStripes, summarizeStripe } from './sampleStripes';

type LinePoint = { x: number; y: number };

function fitLocalTangent(points: LinePoint[], centerX: number, stripeWidth: number) {
  let localPoints = points.filter(point => Math.abs(point.x - centerX) <= stripeWidth / 4);
  if (localPoints.length < 2) {
    localPoints = [...points]
      .sort((first, second) => Math.abs(first.x - centerX) - Math.abs(second.x - centerX))
      .slice(0, 4);
  }
  if (!localPoints.length) return 0.5;

  const meanX = average(localPoints.map(point => point.x));
  const meanY = average(localPoints.map(point => point.y));
  const variance = localPoints.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  const slope = variance
    ? localPoints.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / variance
    : 0;
  const angle = Math.atan(-slope) * 180 / Math.PI;
  return clampUnit((angle + 90) / 180);
}

export function extractLineToFollow(image: ImagePixels, steps: number, options: AnalysisOptions): Feature[] {
  return sampleImageStripes(image, steps, true).map(stripe => {
    const feature = summarizeStripe(stripe, options);
    const linePoints: LinePoint[] = stripe.columns.flatMap(column => {
      const matches = column.samples.filter(sample => matchesTarget(sample, options));
      return matches.length
        ? [{ x: column.x, y: average(matches.map(sample => sample.y)) }]
        : [];
    });

    if (!linePoints.length) {
      return { ...feature, linePosition: 0.5, lineArea: 0, lineTangent: 0.5, lineFound: false };
    }

    const centerX = (stripe.x0 + Math.min(image.width, stripe.x1) - 1) / 2;
    const localPoints = linePoints.filter(point => Math.abs(point.x - centerX) <= stripe.width / 4);
    const tangentPoints = localPoints.length >= 2 ? localPoints : linePoints;
    const meanX = average(tangentPoints.map(point => point.x));
    const meanY = average(tangentPoints.map(point => point.y));
    const variance = tangentPoints.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
    const slope = variance
      ? tangentPoints.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / variance
      : 0;
    const centerY = meanY + slope * (centerX - meanX);
    const linePosition = clampUnit(1 - centerY / Math.max(1, image.height - 1));
    const lineArea = average(linePoints.map(point => clampUnit((image.height - 1 - point.y) / Math.max(1, image.height - 1))));
    const lineTangent = fitLocalTangent(tangentPoints, centerX, stripe.x1 - stripe.x0);

    return {
      ...feature,
      hue: linePosition * 360,
      saturation: lineArea,
      edge: lineTangent,
      linePosition,
      lineArea,
      lineTangent,
      lineFound: true,
    };
  });
}