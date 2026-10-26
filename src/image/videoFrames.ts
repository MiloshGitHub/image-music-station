import { getPixels } from './rotateImage';
import type { ImagePixels } from './analysisTypes';

export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const CODEC_HINT = 'This browser cannot decode that video. Try an MP4 (H.264) or WebM clip.';

function waitFor(video: HTMLVideoElement, event: 'loadeddata' | 'seeked', timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => done(new Error(CODEC_HINT)), timeoutMs);
    const onError = () => done(new Error(CODEC_HINT));
    const onEvent = () => done();
    function done(error?: Error) {
      window.clearTimeout(timer);
      video.removeEventListener(event, onEvent);
      video.removeEventListener('error', onError);
      if (error) reject(error);
      else resolve();
    }
    video.addEventListener(event, onEvent);
    video.addEventListener('error', onError);
  });
}

async function seek(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < 0.01) return;
  const done = waitFor(video, 'seeked', 8000);
  video.currentTime = time;
  await done;
}

export async function extractVideoFrames(url: string, count: number): Promise<{ frames: ImagePixels[]; duration: number }> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const loaded = waitFor(video, 'loadeddata', 10000);
  video.src = url;
  await loaded;
  // Some recorded clips report an infinite duration until the end is reached.
  if (!Number.isFinite(video.duration)) {
    await seek(video, 1e101).catch(() => undefined);
    await seek(video, 0);
  }
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (!video.videoWidth || !video.videoHeight) throw new Error(CODEC_HINT);
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not read video frames.');
  const frames: ImagePixels[] = [];
  for (let i = 0; i < count; i += 1) {
    await seek(video, duration ? ((i + 0.5) / count) * duration : 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(getPixels(canvas));
  }
  return { frames, duration };
}
