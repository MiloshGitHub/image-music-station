export function drawRotatedImage(source: HTMLImageElement, degrees: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const sideways = degrees % 180 !== 0;
  canvas.width = sideways ? source.naturalHeight : source.naturalWidth;
  canvas.height = sideways ? source.naturalWidth : source.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create image canvas.');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(degrees * Math.PI / 180);
  ctx.drawImage(source, -source.naturalWidth / 2, -source.naturalHeight / 2);
  return canvas;
}

export function getPixels(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not read image pixels.');
  const maxSide = 512;
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(canvas.width * scale));
  small.height = Math.max(1, Math.round(canvas.height * scale));
  const smallCtx = small.getContext('2d', { willReadFrequently: true });
  if (!smallCtx) throw new Error('Could not prepare image pixels.');
  smallCtx.drawImage(canvas, 0, 0, small.width, small.height);
  return { data: smallCtx.getImageData(0, 0, small.width, small.height).data, width: small.width, height: small.height };
}