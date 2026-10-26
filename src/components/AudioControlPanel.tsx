import { useEffect, useRef, useState } from 'react';
import { Activity, SlidersHorizontal } from 'lucide-react';
import type { AudioEngine } from '../audio/AudioEngine';
import './AudioControlPanel.css';

type AudioControlPanelProps = {
  engine: AudioEngine | null;
  playing: boolean;
};

export default function AudioControlPanel({ engine, playing }: AudioControlPanelProps) {
  const [attack, setAttack] = useState(0.008);
  const [decay, setDecay] = useState(0.12);
  const [sustain, setSustain] = useState(0.35);
  const [release, setRelease] = useState(0.18);
  const [cutoff, setCutoff] = useState(12000);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    engine?.setEnvelope(attack, decay, sustain, release);
  }, [engine, attack, decay, sustain, release]);

  useEffect(() => {
    engine?.setFilterFrequency(cutoff);
  }, [engine, cutoff]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    let frame = 0;
    let last = 0;
    const draw = (now = 0) => {
      frame = window.requestAnimationFrame(draw);
      if (now - last < 33) return;
      last = now;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const pixelRatio = window.devicePixelRatio || 1;
      if (canvas.width !== width * pixelRatio || canvas.height !== height * pixelRatio) {
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.fillStyle = '#10171b';
      context.fillRect(0, 0, width, height);
      context.strokeStyle = 'rgba(146, 177, 168, 0.13)';
      context.lineWidth = 1;
      for (let row = 1; row < 4; row += 1) {
        const y = (height * row) / 4;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }

      const samples = playing && engine ? engine.getWaveform() : null;
      context.strokeStyle = '#9be0c8';
      context.lineWidth = 2;
      context.beginPath();
      for (let x = 0; x < width; x += 1) {
        const index = samples?.length ? Math.floor((x / width) * samples.length) : 0;
        const sample = samples?.length ? samples[index] : 0;
        const y = height / 2 - sample * height * 0.42;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    };

    draw();
    return () => window.cancelAnimationFrame(frame);
  }, [engine, playing]);

  return (
    <section className="audio-console panel" aria-labelledby="audio-console-title">
      <div className="audio-console-heading">
        <div>
          <span className="eyebrow">03 / SOUND DESIGN</span>
          <h2 id="audio-console-title">Audio engine</h2>
        </div>
        <span className={`audio-state${playing ? ' is-playing' : ''}`}>
          <Activity size={14} /> {playing ? 'SIGNAL ACTIVE' : 'STANDBY'}
        </span>
      </div>
      <div className="audio-console-layout">
        <div className="waveform-block">
          <div className="audio-section-label"><Activity size={14} /> OUTPUT WAVEFORM</div>
          <canvas ref={canvasRef} className="waveform-canvas" aria-label="Live audio output waveform" />
          <div className="waveform-scale"><span>-1.0</span><span>0</span><span>+1.0</span></div>
        </div>
        <div className="audio-parameters">
          <div className="audio-section-label"><SlidersHorizontal size={14} /> AMPLITUDE ENVELOPE</div>
          <div className="adsr-controls">
            <label className="audio-control" title="Attack">
              <span>A<output>{attack.toFixed(3)}s</output></span>
              <input aria-label="Attack" type="range" min="0.001" max="1" step="0.001" value={attack} onChange={event => setAttack(Number(event.target.value))} />
            </label>
            <label className="audio-control" title="Decay">
              <span>D<output>{decay.toFixed(2)}s</output></span>
              <input aria-label="Decay" type="range" min="0.01" max="1" step="0.01" value={decay} onChange={event => setDecay(Number(event.target.value))} />
            </label>
            <label className="audio-control" title="Sustain">
              <span>S<output>{Math.round(sustain * 100)}%</output></span>
              <input aria-label="Sustain" type="range" min="0" max="1" step="0.01" value={sustain} onChange={event => setSustain(Number(event.target.value))} />
            </label>
            <label className="audio-control" title="Release">
              <span>R<output>{release.toFixed(2)}s</output></span>
              <input aria-label="Release" type="range" min="0.01" max="2" step="0.01" value={release} onChange={event => setRelease(Number(event.target.value))} />
            </label>
          </div>
          <label className="audio-control cutoff-control">
            <span>LOW-PASS <output>{cutoff >= 1000 ? `${(cutoff / 1000).toFixed(1)} kHz` : `${cutoff} Hz`}</output></span>
            <input aria-label="Low-pass cutoff" type="range" min="200" max="18000" step="100" value={cutoff} onChange={event => setCutoff(Number(event.target.value))} />
          </label>
        </div>
      </div>
    </section>
  );
}