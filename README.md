# Image Music Station

A local-first browser prototype that turns images (and short videos) into a synth sequence, a drum pattern and ambient pad chords.

## Requirements
- Node.js 20 or newer (Node.js 22 LTS recommended)
- npm
- A modern browser (Chrome, Edge, Firefox, or Safari)

## Run locally
```bash
npm install
npm run dev
```
Open the local URL printed by Vite (normally http://localhost:5173).

## Build and test
```bash
npm test
npm run build
npm run preview
```

## Tracks
The app has three tracks, each analysing an image locally. The synth track uses the main image; the drum and pad tracks can use it or their own upload.

### 1. Synth (step sequencer)
- Image upload and camera capture input (camera availability depends on browser permissions and secure context).
- Rotate image in 90-degree increments.
- 8, 16, 24, 32, or 64 steps, with a selectable note length.
- Two image analysis modes: color stripes and line to follow.
- Independent pitch, duration and volume/velocity source mappings.
- Scale quantization, root note, pitch range, threshold and BPM controls.
- Circular and grid sequencer views with editable steps.
- Sound design panel: ADSR envelope, low-pass filter and live output waveform.
- MIDI export of the synth track using `@tonejs/midi`.

### 2. Drums (16-channel drum rack)
- The image is scanned left to right; colors are grouped into 16 hue bands, each mapped to one drum sound.
- **Drum threshold** slider (0-100%): higher values ignore pale or dark pixels and keep only the dominant, saturated colors, so busy images no longer fill every trigger.
- Optional separate image upload, 8-64 steps, clickable pads to edit the pattern.
- **Drum mixer** (section 3): a horizontal fader per drum sound (0-150%, 0 mutes), lined up row-for-row with the drum rack, with a reset button, applied live.

### 3. Pads (continuous ambient chords)
- Upload an **image or a short video** (up to 60 MB). An image is split left to right into sections; a video is sampled at 12 frames over time.
- Each section's dominant hue picks a chord in the selected scale and root; saturation sets the chord size, brightness sets register and length (dark sections last longer). Identical neighbouring chords merge.
- Controls: sections, bars per section, color sensitivity.
- There is no step grid: each chord is held for its number of bars, then the next fades in, and the sequence loops with the transport (4/4 assumed).
- Chord timeline highlights the playing chord.
- **Pad engine** panel: live pad waveform, attack, release, low-pass, chorus, and reverb (mix, size, damping).
- Video decoding depends on the browser; if a file fails, use an H.264 MP4 or WebM clip.

### Mixer
Per-track volume sliders (synth, drums, pads) plus master volume and a shared BPM.

## Audio quality
The engine uses a `playback` latency hint with a 0.2 s look-ahead, a master limiter, a convolution reverb for pads and a light 2-oscillator pad voice. UI updates are synced to the audio clock and the drum grid is memoized. If playback stutters, use `npm run build && npm run preview` (the dev build is much heavier) and close other heavy tabs.

## Notes / current scope
This is an experimental browser-based image-to-music station. Only the synth track is exported to MIDI; drums and pads are playback-only. Local-only processing: images and videos are never uploaded to a server.

Hue is a circular quantity, so color stripes use a circular mean rather than an ordinary arithmetic average. Image brightness is calculated separately. Duration maps to a gate fraction of the step and does not alter pitch extraction.

## Project layout
- `src/image/` image loading, rotation, video frame extraction and feature extraction
- `src/music/` scales, pitch/duration mapping, drum rack and pad chord analysis, event types
- `src/audio/` Tone.js playback
- `src/components/` interface components
- `src/tests/` mapping tests
