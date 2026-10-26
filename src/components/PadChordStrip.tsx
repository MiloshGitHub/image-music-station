import type { CSSProperties } from 'react';
import type { PadChord } from '../music/events';
import { midiName } from '../music/scales';

type Props = { chords: PadChord[]; activeChord: number };

export default function PadChordStrip({ chords, activeChord }: Props) {
  if (!chords.length) return <div className="pad-empty">No chords yet — upload an image or a short video.</div>;
  const totalBars = chords.reduce((sum, chord) => sum + chord.bars, 0);
  return (
    <div className="pad-strip" aria-label="Pad chord timeline">
      {chords.map(chord => (
        <div
          key={chord.index}
          className={`pad-chord${chord.index === activeChord ? ' is-playhead' : ''}`}
          style={{ flexGrow: chord.bars, '--pad-color': chord.color, '--pad-velocity': String(chord.velocity) } as CSSProperties}
          title={`${chord.bars} bar${chord.bars > 1 ? 's' : ''}`}
        >
          <b>{midiName(chord.notes[0]).replace(/\d/, '')}</b>
          <span>{chord.notes.map(note => midiName(note)).join(' ')}</span>
          <small>{chord.bars} bar{chord.bars > 1 ? 's' : ''} · {Math.round((chord.bars / totalBars) * 100)}%</small>
        </div>
      ))}
    </div>
  );
}
