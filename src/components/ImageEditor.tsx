import { useEffect, useRef } from 'react';

type Props = { imageUrl: string | null; rotation: number; onCanvas: (canvas: HTMLCanvasElement) => void };

export default function ImageEditor({ imageUrl, rotation, onCanvas }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;
    const image = new Image();
    image.onload = () => {
      const sideways = rotation % 180 !== 0;
      const sourceW = image.naturalWidth, sourceH = image.naturalHeight;
      const scale = Math.min(1, 800 / Math.max(sourceW, sourceH));
      const w = Math.max(1, Math.round(sourceW * scale)), h = Math.max(1, Math.round(sourceH * scale));
      canvas.width = sideways ? h : w;
      canvas.height = sideways ? w : h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rotation * Math.PI / 180);
      ctx.drawImage(image, -w / 2, -h / 2, w, h);
      onCanvas(canvas);
    };
    image.src = imageUrl;
  }, [imageUrl, rotation, onCanvas]);
  return <canvas ref={canvasRef} className="image-canvas" aria-label="Rotated source image preview" />;
}