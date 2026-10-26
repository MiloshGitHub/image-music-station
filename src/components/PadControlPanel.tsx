import { useEffect, useRef, useState } from 'react';
import { Activity, SlidersHorizontal, Waves } from 'lucide-react';
import type { AudioEngine } from '../audio/AudioEngine';
import './AudioControlPanel.css';

type Props = { engine: AudioEngine | null; playing: boolean };

export default function PadControlPanel({ engine, playing }: Props) {
  const [attack, setAttack] = useState(1.6);
  const [release, setRelease] = useState(3.5);
  const [cutoff, setCutoff] = useState(1600);
  const [chorus, setChorus] = useState(0.6);
  const [roomSize, setRoomSize] = useState(0.88);
  const [dampening, setDampening] = useState(3000);
  const [wet, setWet] = useState(0.45);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { engine?.setPadEnvelope(attack, release); }, [engine, attack, release]);
  useEffect(() => { engine?.setPadFilterFrequency(cutoff); }, [engine, cutoff]);
  useEffect(() => { engine?.setPadChorus(chorus); }, [engine, chorus]);
  useEffect(() => { engine?.setPadReverb(roomSize, dampening, wet); }, [engine, roomSize, dampening, wet]);

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
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio;
        canvas.height = height * ratio;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = '#10171b';
      context.fillRect(0, 0, width, height);
      context.strokeStyle = 'rgba(146, 177, 168, 0.13)';
      for (let row = 1; row < 4; row += 1) {
        context.beginPath();
        context.moveTo(0, (height * row) / 4);
        context.lineTo(width, (height * row) / 4);
        context.stroke();
      }
      const samples = playing && engine ? engine.getPadWaveform() : null;
      context.strokeStyle = '#b9a6ff';
      context.lineWidth = 2;
      context.beginPath();
      for (let x = 0; x < width; x += 1) {
        const sample = samples?.length ? samples[Math.floor((x / width) * samples.length)] : 0;
        const y = height / 2 - sample * height * 0.42;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    };
    draw();
    return () => window.cancelAnimationFrame(frame);
  }, [engine, playing]);

  const hz = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)} kHz` : `${value} Hz`);

  return (
    <section className="audio-console panel pad-console" aria-labelledby="pad-console-title">
      <div className="audio-console-heading">
        <div>
          <span className="eyebrow">03 / PAD SOUND + REVERB</span>
          <h2 id="pad-console-title">Pad engine</h2>
        </div>
        <span className={`audio-state${playing ? ' is-playing' : ''}`}><Activity size={14} /> {playing ? 'SIGNAL ACTIVE' : 'STANDBY'}</span>
      </div>
      <div className="pad-console-layout">
        <div className="waveform-block">
          <div className="audio-section-label"><Activity size={14} /> PAD WAVEFORM</div>
          <canvas ref={canvasRef} className="waveform-canvas" aria-label="Live pad waveform" />
        </div>
        <div className="audio-parameters">
          <div className="audio-section-label"><SlidersHorizontal size={14} /> TONE</div>
          <div className="adsr-controls">
            <label className="audio-control"><span>ATTACK<output>{attack.toFixed(1)}s</output></span><input aria-label="Pad attack" type="range" min="0.05" max="6" step="0.05" value={attack} onChange={e => setAttack(Number(e.target.value))} /></label>
            <label className="audio-control"><span>RELEASE<output>{release.toFixed(1)}s</output></span><input aria-label="Pad release" type="range" min="0.1" max="10" step="0.1" value={release} onChange={e => setRelease(Number(e.target.value))} /></label>
            <label className="audio-control"><span>LOW-PASS<output>{hz(cutoff)}</output></span><input aria-label="Pad low-pass" type="range" min="200" max="12000" step="100" value={cutoff} onChange={e => setCutoff(Number(e.target.value))} /></label>
            <label className="audio-control"><span>CHORUS<output>{Math.round(chorus * 100)}%</output></span><input aria-label="Pad chorus depth" type="range" min="0" max="1" step="0.01" value={chorus} onChange={e => setChorus(Number(e.target.value))} /></label>
          </div>
          <div className="audio-section-label"><Waves size={14} /> REVERB</div>
          <div className="adsr-controls">
            <label className="audio-control"><span>MIX<output>{Math.round(wet * 100)}%</output></span><input aria-label="Reverb mix" type="range" min="0" max="1" step="0.01" value={wet} onChange={e => setWet(Number(e.target.value))} /></label>
            <label className="audio-control"><span>SIZE<output>{Math.round(roomSize * 100)}%</output></span><input aria-label="Reverb size" type="range" min="0.1" max="0.98" step="0.01" value={roomSize} onChange={e => setRoomSize(Number(e.target.value))} /></label>
            <label className="audio-control"><span>DAMPING<output>{hz(dampening)}</output></span><input aria-label="Reverb damping" type="range" min="500" max="10000" step="100" value={dampening} onChange={e => setDampening(Number(e.target.value))} /></label>
          </div>
        </div>
      </div>
    </section>
  );
}
