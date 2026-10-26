import * as Tone from 'tone';
import type { DrumPattern, NoteEvent, PadChord } from '../music/events';
import { DEFAULT_DRUM_SAMPLE_PATHS, DRUM_SAMPLE_OPTIONS, getDrumSampleCategory } from '../music/drumSamples';

type PatternConfig = {
  synthEvents: NoteEvent[];
  drumPattern: DrumPattern;
  bpm: number;
  onStep?: (step: number) => void;
  onDrumStep?: (step: number) => void;
  stepNotation?: string;
  padChords?: PadChord[];
  onPadChord?: (index: number) => void;
};

let contextConfigured = false;
// A larger buffer and scheduling look-ahead trade a little latency for glitch-free playback.
function configureContext() {
  if (contextConfigured) return;
  contextConfigured = true;
  Tone.setContext(new Tone.Context({ latencyHint: 'playback', lookAhead: 0.2 }));
}

export class AudioEngine {
  private synth: Tone.PolySynth;
  private filter: Tone.Filter;
  private analyser: Tone.Analyser;
  private limiter: Tone.Limiter;
  private drumBus: Tone.Gain;
  private drumVoices: Tone.MembraneSynth[];
  private drumSamples: Array<Tone.Player | null> = Array(16).fill(null);
  private drumSampleLoaded: boolean[] = Array(16).fill(false);
  private drumSampleVersions: number[] = Array(16).fill(0);
  private drumSamplePaths = [...DEFAULT_DRUM_SAMPLE_PATHS];
  private drumSampleLoads: Promise<void>[] = [];
  private drumChannelGains: number[] = Array(16).fill(1);
  private drumNotes: string[];
  private drumPattern: DrumPattern = { steps: 16, channels: [], hits: [] };
  private padSynth: Tone.PolySynth;
  private padFilter: Tone.Filter;
  private padChorus: Tone.Chorus;
  private padReverb: Tone.Reverb;
  private padReverbDamping: Tone.Filter;
  private padDry: Tone.Gain;
  private padWet: Tone.Gain;
  private padReverbTimer: number | null = null;
  private padGain: Tone.Gain;
  private padAnalyser: Tone.Analyser;
  private padChords: PadChord[] = [];
  private onPadChord?: (index: number) => void;
  private padLoopId: number | null = null;
  private loopId: number | null = null;
  private disposed = false;
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordingChunks: Blob[] = [];
  private recordingResult: Promise<Blob> | null = null;
  private resolveRecording?: (blob: Blob) => void;
  private rejectRecording?: (error: Error) => void;
  private events: NoteEvent[] = [];
  private bpm = 112;
  private stepNotation = '16n';
  private onStep?: (step: number) => void;
  private onDrumStep?: (step: number) => void;

  constructor() {
    configureContext();
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.008, decay: 0.12, sustain: 0.35, release: 0.18 },
    });
    this.filter = new Tone.Filter({ frequency: 12000, type: 'lowpass', rolloff: -12 });
    this.analyser = new Tone.Analyser('waveform', 256);
    this.drumBus = new Tone.Gain(0.9);
    this.drumNotes = ['C1', 'D1', 'E1', 'F1', 'G1', 'A1', 'B1', 'C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3'];
    this.drumVoices = this.drumNotes.map((_, index) => new Tone.MembraneSynth({
      pitchDecay: 0.012 + index * 0.002,
      octaves: 2 + (index % 3),
      envelope: { attack: 0.001, decay: 0.18 + index * 0.006, sustain: 0.01, release: 0.08 },
    }));
    this.drumSampleLoads = this.drumSamplePaths.map((url, channel) => this.loadDrumSample(channel, url));
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 2, spread: 24 },
      envelope: { attack: 1.6, decay: 0.8, sustain: 0.85, release: 3.5 },
    });
    this.padFilter = new Tone.Filter({ frequency: 1600, type: 'lowpass', rolloff: -24 });
    this.padChorus = new Tone.Chorus(0.4, 3.5, 0.6).start();
    // Convolution reverb runs natively; the dry/wet split keeps damping from dulling the dry pad.
    this.padReverb = new Tone.Reverb({ decay: 9, preDelay: 0.03, wet: 1 });
    this.padReverbDamping = new Tone.Filter({ frequency: 3000, type: 'lowpass', rolloff: -12 });
    this.padDry = new Tone.Gain(0.55);
    this.padWet = new Tone.Gain(0.45);
    this.padGain = new Tone.Gain(0.75);
    this.padAnalyser = new Tone.Analyser('waveform', 256);
    this.padGain.connect(this.padAnalyser);
    this.padSynth.volume.value = -14;
    this.padSynth.chain(this.padFilter, this.padChorus);
    this.padChorus.connect(this.padDry);
    this.padChorus.chain(this.padReverbDamping, this.padReverb, this.padWet);
    this.padDry.connect(this.padGain);
    this.padWet.connect(this.padGain);
    this.padGain.connect(this.filter);
    this.synth.connect(this.filter);
    this.drumBus.connect(this.filter);
    this.drumVoices.forEach((voice, index) => {
      voice.connect(this.drumBus);
      voice.volume.value = -10 + (index % 4) * 1.5;
    });
    this.limiter = new Tone.Limiter(-2);
    this.filter.connect(this.analyser);
    this.analyser.connect(this.limiter);
    this.limiter.toDestination();
    this.synth.volume.value = -7;
  }

  setPattern({ synthEvents, drumPattern, bpm, onStep, onDrumStep, stepNotation = '16n', padChords = [], onPadChord }: PatternConfig) {
    this.padChords = padChords;
    this.onPadChord = onPadChord;
    this.events = synthEvents;
    this.drumPattern = drumPattern;
    this.bpm = bpm;
    this.onStep = onStep;
    this.onDrumStep = onDrumStep;
    this.stepNotation = stepNotation;
  }

  async play() {
    await Tone.start();
    await Promise.all(this.drumSampleLoads);
    this.stop();
    Tone.getTransport().bpm.value = this.bpm;
    let current = 0;
    let drumStep = 0;
    this.loopId = Tone.getTransport().scheduleRepeat((time) => {
      const event = this.events[current];
      const drumHits = this.drumPattern.hits.filter(hit => hit.step === drumStep && hit.active);
      const stepNow = current;
      const drumNow = drumStep;
      // Draw fires on the animation frame nearest to the audio time, so visuals match what you hear.
      Tone.getDraw().schedule(() => {
        this.onStep?.(stepNow);
        this.onDrumStep?.(drumNow);
      }, time);
      if (event?.active && Math.random() <= event.probability) {
        this.synth.triggerAttackRelease(Tone.Frequency(event.pitch, 'midi').toNote(), event.duration * 60 / this.bpm, time, event.velocity);
      }
      drumHits.forEach(hit => {
        const channel = hit.channel % this.drumVoices.length;
        const note = this.drumNotes[channel];
        const synth = this.drumVoices[channel];
        const length = Math.max(0.05, (0.09 + hit.velocity * 0.16) * 60 / this.bpm);
        const gain = this.drumChannelGains[channel];
        const sample = this.drumSamples[channel];
        if (gain <= 0) return;
        if (this.drumSampleLoaded[channel] && sample) {
          sample.volume.setValueAtTime(-8 + 20 * Math.log10(gain * Math.max(0.1, hit.velocity)), time);
          sample.start(time);
        } else {
          synth.triggerAttackRelease(note, length, time, Math.max(0.1, hit.velocity));
        }
      });
      current = (current + 1) % Math.max(1, this.events.length);
      drumStep = (drumStep + 1) % Math.max(1, this.drumPattern.steps);
    }, this.stepNotation);
    this.schedulePad();
    Tone.getTransport().start();
  }

  async startRecording() {
    if (this.mediaRecorder?.state === 'recording') return;
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('Audio recording is not supported in this browser.');
    }
    await Tone.start();
    const audioContext = Tone.getContext().rawContext;
    if (!('createMediaStreamDestination' in audioContext)) {
      throw new Error('Audio recording requires a live browser audio context.');
    }
    const destination = audioContext.createMediaStreamDestination();
    Tone.getDestination().output.connect(destination);

    const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']
      .find(type => MediaRecorder.isTypeSupported(type));
    try {
      const recorder = new MediaRecorder(destination.stream, mimeType ? { mimeType } : undefined);
      this.recordingDestination = destination;
      this.mediaRecorder = recorder;
      this.recordingChunks = [];
      this.recordingResult = new Promise<Blob>((resolve, reject) => {
        this.resolveRecording = resolve;
        this.rejectRecording = reject;
      });
      recorder.addEventListener('dataavailable', event => {
        if (event.data.size > 0) this.recordingChunks.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        const blob = new Blob(this.recordingChunks, { type: recorder.mimeType || 'audio/webm' });
        const resolve = this.resolveRecording;
        this.cleanupRecording();
        resolve?.(blob);
      }, { once: true });
      recorder.addEventListener('error', event => {
        const reject = this.rejectRecording;
        const message = 'error' in event && event.error instanceof Error ? event.error.message : 'unknown error';
        this.cleanupRecording();
        reject?.(new Error(`Audio recording failed: ${message}`));
      }, { once: true });
      recorder.start();
    } catch (error) {
      this.cleanupRecording();
      throw error;
    }
  }

  stopRecording(): Promise<Blob> {
    const recorder = this.mediaRecorder;
    if (!recorder || recorder.state === 'inactive' || !this.recordingResult) {
      throw new Error('There is no active recording.');
    }
    recorder.stop();
    return this.recordingResult;
  }

  private cleanupRecording() {
    const destination = this.recordingDestination;
    if (destination) {
      Tone.getDestination().output.disconnect(destination);
      destination.stream.getTracks().forEach(track => track.stop());
    }
    this.recordingDestination = null;
    this.mediaRecorder = null;
    this.recordingChunks = [];
    this.recordingResult = null;
    this.resolveRecording = undefined;
    this.rejectRecording = undefined;
  }

  // Pads play continuously: one chord is held for its number of bars, then the next one fades in.
  private schedulePad() {
    let index = 0;
    let barsLeft = 0;
    this.padLoopId = Tone.getTransport().scheduleRepeat((time) => {
      if (!this.padChords.length) return;
      if (barsLeft <= 0) {
        index %= this.padChords.length;
        const chord = this.padChords[index];
        const seconds = chord.bars * 4 * 60 / this.bpm;
        const notes = chord.notes.map(note => Tone.Frequency(note, 'midi').toNote());
        this.padSynth.triggerAttackRelease(notes, seconds, time, chord.velocity);
        Tone.getDraw().schedule(() => this.onPadChord?.(chord.index), time);
        barsLeft = chord.bars;
        index += 1;
      }
      barsLeft -= 1;
    }, '1m');
  }

  stop() {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    if (this.loopId !== null) {
      transport.clear(this.loopId);
      this.loopId = null;
    }
    if (this.padLoopId !== null) {
      transport.clear(this.padLoopId);
      this.padLoopId = null;
    }
    this.synth.releaseAll();
    this.padSynth.releaseAll();
  }

  setMasterVolume(db: number) {
    Tone.getDestination().volume.value = db;
  }

  setSynthVolume(db: number) {
    this.synth.volume.value = db;
  }

  setPadEnvelope(attack: number, release: number) {
    this.padSynth.set({ envelope: { attack, release } });
  }

  setPadFilterFrequency(frequency: number) {
    this.padFilter.frequency.value = frequency;
  }

  setPadReverb(roomSize: number, dampening: number, wet: number) {
    this.padWet.gain.value = wet;
    this.padDry.gain.value = 1 - wet * 0.45;
    this.padReverbDamping.frequency.value = dampening;
    // Regenerating the impulse response is costly, so only do it once the slider settles.
    const decay = 1.5 + roomSize * 11;
    if (Math.abs(decay - Number(this.padReverb.decay)) < 0.05) return;
    if (this.padReverbTimer !== null) window.clearTimeout(this.padReverbTimer);
    this.padReverbTimer = window.setTimeout(() => {
      this.padReverbTimer = null;
      this.padReverb.decay = decay;
    }, 250);
  }

  setPadChorus(depth: number) {
    this.padChorus.depth = depth;
  }

  getPadWaveform() {
    const value = this.padAnalyser.getValue();
    return Array.isArray(value) ? value[0] ?? new Float32Array(0) : value;
  }

  setPadVolume(gain: number) {
    this.padGain.gain.value = gain;
  }

  setDrumChannelVolume(channel: number, gain: number) {
    const voice = this.drumVoices[channel];
    if (!voice) return;
    this.drumChannelGains[channel] = Math.max(0, gain);
    // Per-voice base level (matches the constructor) plus a user gain; 0 mutes.
    voice.volume.value = gain <= 0 ? -Infinity : -10 + (channel % 4) * 1.5 + 20 * Math.log10(gain);
  }

  setDrumSample(channel: number, url: string) {
    const category = getDrumSampleCategory(channel);
    if (this.disposed) return;
    if (!Number.isInteger(channel) || channel < 0 || channel >= this.drumSamplePaths.length) return;
    if (!DRUM_SAMPLE_OPTIONS[category].some(sample => sample.url === url)) return;
    if (this.drumSamplePaths[channel] === url) return;
    this.drumSamplePaths[channel] = url;
    this.drumSampleLoads[channel] = this.loadDrumSample(channel, url);
  }

  private loadDrumSample(channel: number, url: string): Promise<void> {
    const version = this.drumSampleVersions[channel] + 1;
    this.drumSampleVersions[channel] = version;
    return new Promise(resolve => {
      const player = new Tone.Player({
        url,
        onload: () => {
          if (this.disposed || this.drumSampleVersions[channel] !== version) {
            player.dispose();
            resolve();
            return;
          }
          const previous = this.drumSamples[channel];
          this.drumSamples[channel] = player;
          this.drumSampleLoaded[channel] = true;
          previous?.dispose();
          resolve();
        },
        onerror: error => {
          console.error(`Could not load drum sample ${url}; using the synth fallback.`, error);
          if (this.drumSampleVersions[channel] === version) {
            this.drumSamples[channel]?.dispose();
            this.drumSamples[channel] = null;
            this.drumSampleLoaded[channel] = false;
          }
          player.dispose();
          resolve();
        },
      });
      player.connect(this.drumBus);
    });
  }

  setDrumVolume(gain: number) {
    this.drumBus.gain.value = gain;
  }

  setEnvelope(attack: number, decay: number, sustain: number, release: number) {
    this.synth.set({ envelope: { attack, decay, sustain, release } });
  }

  setFilterFrequency(frequency: number) {
    this.filter.frequency.value = frequency;
  }

  getWaveform() {
    const value = this.analyser.getValue();
    return Array.isArray(value) ? value[0] ?? new Float32Array(0) : value;
  }

  dispose() {
    this.disposed = true;
    if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.stop();
    this.stop();
    this.synth.dispose();
    this.padSynth.dispose();
    this.padFilter.dispose();
    this.padChorus.dispose();
    if (this.padReverbTimer !== null) window.clearTimeout(this.padReverbTimer);
    this.padReverb.dispose();
    this.padReverbDamping.dispose();
    this.padDry.dispose();
    this.padWet.dispose();
    this.padGain.dispose();
    this.padAnalyser.dispose();
    this.drumBus.dispose();
    this.drumVoices.forEach(voice => voice.dispose());
    this.drumSamples.forEach(sample => sample?.dispose());
    this.filter.dispose();
    this.analyser.dispose();
    this.limiter.dispose();
  }
}