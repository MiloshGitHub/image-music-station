import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { DrumPattern } from '../music/events';
import { usePlayhead } from '../audio/playhead';
import type { Playhead } from '../audio/playhead';

type DrumRackGridProps = {
  pattern: DrumPattern;
  playhead: Playhead;
  onToggle: (channel: number, step: number) => void;
};

type DrumStepProps = {
  channel: number;
  step: number;
  name: string;
  color: string;
  active: boolean;
  velocity: number;
  playhead: boolean;
  onToggle: (channel: number, step: number) => void;
};

// Memoized so a moving playhead only re-renders the two cells that change.
const DrumStep = memo(function DrumStep({ channel, step, name, color, active, velocity, playhead, onToggle }: DrumStepProps) {
  return (
    <button
      className={`drum-step${active ? ' is-active' : ''}${playhead ? ' is-playhead' : ''}`}
      style={{ '--drum-color': color, '--drum-velocity': String(velocity) } as CSSProperties}
      onClick={() => onToggle(channel, step)}
      title={`${name} step ${step + 1}${active ? ' active' : ' muted'}`}
    />
  );
});

function cellKey(channel: number, step: number) {
  return `${channel}:${step}`;
}

export default function DrumRackGrid({ pattern, playhead, onToggle }: DrumRackGridProps) {
  const activeStep = usePlayhead(playhead);
  const cellMap = new Map(pattern.hits.map(hit => [cellKey(hit.channel, hit.step), hit]));
  return (
    <div className="drum-rack-grid" role="grid" aria-label="Drum rack sequencer grid">
      {pattern.channels.map(channel => (
        <div key={channel.index} className="drum-row" role="row">
          <button className="drum-pad" style={{ borderColor: channel.color, color: channel.color }}>
            {channel.name}
          </button>
          <div className="drum-steps">
            {Array.from({ length: pattern.steps }, (_, step) => {
              const hit = cellMap.get(cellKey(channel.index, step));
              return (
                <DrumStep
                  key={`${channel.index}-${step}`}
                  channel={channel.index}
                  step={step}
                  name={channel.name}
                  color={channel.color}
                  active={hit?.active ?? false}
                  velocity={hit?.velocity ?? 0.3}
                  playhead={step === activeStep}
                  onToggle={onToggle}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
