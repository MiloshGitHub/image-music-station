import type { CSSProperties } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { DrumChannel } from '../music/events';

type Props = {
  channels: DrumChannel[];
  volumes: number[];
  onChange: (channel: number, value: number) => void;
  onReset: () => void;
};

export default function DrumMixer({ channels, volumes, onChange, onReset }: Props) {
  return (
    <section className="panel drum-mixer-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">03 / DRUM MIXER</span><h2>Sound levels</h2></div>
        <button className="secondary-button" onClick={onReset}><SlidersHorizontal size={14} /> Reset</button>
      </div>
      <div className="drum-mixer">
        {channels.map(channel => (
          <label key={channel.index} className="drum-fader" style={{ '--drum-color': channel.color } as CSSProperties}>
            <input
              aria-label={`${channel.name} volume`}
              type="range" min="0" max="150" value={volumes[channel.index]}
              onChange={event => onChange(channel.index, Number(event.target.value))}
            />
            <output>{volumes[channel.index]}%</output>
          </label>
        ))}
      </div>
    </section>
  );
}
