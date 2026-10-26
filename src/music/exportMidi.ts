import { Midi } from '@tonejs/midi';
import type { NoteEvent } from './events';

export function downloadMidi(events: NoteEvent[], bpm: number, stepBeats = 0.25, filename = 'image-music.mid') {
  const midi = new Midi();
  midi.header.setTempo(bpm);
  const track = midi.addTrack();
  track.name = 'Image-derived notes';
  for (const event of events) {
    if (!event.active) continue;
    const startTime = event.step * (60 / bpm) * stepBeats;
    const duration = event.duration * 60 / bpm;
    track.addNote({
      midi: event.pitch,
      time: startTime,
      duration,
      velocity: event.velocity,
    });
  }
  const blob = new Blob([midi.toArray()], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}