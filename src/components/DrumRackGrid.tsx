import { memo, useCallback, useEffect, useRef } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { DrumPattern } from '../music/events';
import { DRUM_SAMPLE_OPTIONS, getDrumSampleCategory } from '../music/drumSamples';
import { usePlayhead } from '../audio/playhead';
import type { Playhead } from '../audio/playhead';

type DrumRackGridProps = {
  pattern: DrumPattern;
  playhead: Playhead;
  onToggle: (channel: number, step: number) => void;
  samplePaths: string[];
  onSampleChange: (channel: number, url: string) => void;
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
  onPointerDown: (channel: number, step: number, active: boolean, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerEnter: (channel: number, step: number, active: boolean, event: ReactPointerEvent<HTMLButtonElement>) => void;
};

// Memoized so a moving playhead only re-renders the two cells that change.
const DrumStep = memo(function DrumStep({
  channel,
  step,
  name,
  color,
  active,
  velocity,
  playhead,
  onToggle,
  onPointerDown,
  onPointerEnter,
}: DrumStepProps) {
  return (
    <button
      className={`drum-step${active ? ' is-active' : ''}${playhead ? ' is-playhead' : ''}`}
      style={{ '--drum-color': color, '--drum-velocity': String(velocity) } as CSSProperties}
      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
        if (event.detail === 0) onToggle(channel, step);
      }}
      onPointerDown={event => onPointerDown(channel, step, active, event)}
      onPointerEnter={event => onPointerEnter(channel, step, active, event)}
      title={`${name} step ${step + 1}${active ? ' active' : ' muted'}`}
    />
  );
});

function cellKey(channel: number, step: number) {
  return `${channel}:${step}`;
}

export default function DrumRackGrid({ pattern, playhead, onToggle, samplePaths, onSampleChange }: DrumRackGridProps) {
  const activeStep = usePlayhead(playhead);
  const dragRef = useRef<{ pointerId: number; active: boolean; touched: Set<string> } | null>(null);
  const stopDragging = useCallback(() => {
    dragRef.current = null;
  }, []);
  const startDragging = useCallback((
    channel: number,
    step: number,
    active: boolean,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0) return;
    const touched = new Set([cellKey(channel, step)]);
    dragRef.current = { pointerId: event.pointerId, active: !active, touched };
    onToggle(channel, step);
  }, [onToggle]);
  const toggleWhileDragging = useCallback((
    channel: number,
    step: number,
    active: boolean,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    const drag = dragRef.current;
    const key = cellKey(channel, step);
    if (!drag || drag.pointerId !== event.pointerId || drag.touched.has(key)) return;
    drag.touched.add(key);
    if (active !== drag.active) onToggle(channel, step);
  }, [onToggle]);

  useEffect(() => {
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
    return () => {
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [stopDragging]);

  const cellMap = new Map(pattern.hits.map(hit => [cellKey(hit.channel, hit.step), hit]));
  return (
    <div className="drum-rack-grid" role="grid" aria-label="Drum rack sequencer grid">
      {pattern.channels.map(channel => (
        <div key={channel.index} className="drum-row" role="row">
          <div className="drum-voice-control">
            <button className="drum-pad" style={{ borderColor: channel.color, color: channel.color }}>
              {channel.name}
            </button>
            <select
              className="drum-sample-select"
              aria-label={`${channel.name} sample`}
              title={`${channel.name} sample`}
              value={samplePaths[channel.index]}
              onChange={event => onSampleChange(channel.index, event.target.value)}
            >
              {DRUM_SAMPLE_OPTIONS[getDrumSampleCategory(channel.index)].map(sample => (
                <option key={sample.url} value={sample.url}>{sample.label}</option>
              ))}
            </select>
          </div>
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
                  onPointerDown={startDragging}
                  onPointerEnter={toggleWhileDragging}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
