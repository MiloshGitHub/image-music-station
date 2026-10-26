import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Circle, Download, ImagePlus, Pause, Play, RotateCcw, RotateCw, Square, Volume2, Waves, X, RotateCw as Refresh } from 'lucide-react';
import type { AnalysisMode, DrumPattern, DurationSource, NoteEvent, PadChord, PitchSource, VolumeSource } from '../music/events';
import { extractFeatures } from '../image/analysis';
import { getPixels } from '../image/rotateImage';
import { mapFeaturesToEvents } from '../music/mapFeatures';
import { analyzeImageToDrumPattern, createEmptyDrumPattern, DEFAULT_DRUM_THRESHOLD } from '../music/drumRack';
import { framesToPadChords, imageToPadChords } from '../music/padChords';
import { extractVideoFrames, MAX_VIDEO_BYTES } from '../image/videoFrames';
import type { ImagePixels } from '../image/analysisTypes';
import DrumMixer from '../components/DrumMixer';
import { createPlayhead } from '../audio/playhead';
import PadControlPanel from '../components/PadControlPanel';
import PadChordStrip from '../components/PadChordStrip';
import { midiName, NOTE_NAMES, SCALES } from '../music/scales';
import { downloadMidi } from '../music/exportMidi';
import { AudioEngine } from '../audio/AudioEngine';
import { DEFAULT_DRUM_SAMPLE_PATHS } from '../music/drumSamples';
import ImageEditor from '../components/ImageEditor';
import CircularSequencer from '../components/CircularSequencer';
import StepGrid from '../components/StepGrid';
import DrumRackGrid from '../components/DrumRackGrid';
import AudioControlPanel from '../components/AudioControlPanel';
import '../components/TrackLayout.css';

const STEP_OPTIONS = [8, 16, 24, 32, 64];
const DRUM_STEP_OPTIONS = [8, 16, 24, 32, 64];
const PAD_SECTION_OPTIONS = [3, 4, 6, 8, 12];
const PAD_BAR_OPTIONS = [1, 2, 4, 8];
const NOTE_TYPES = [
  { value: '1n', label: '1 Whole', beats: 4 },
  { value: '2n', label: '1/2 Half', beats: 2 },
  { value: '4n', label: '1/4 Quarter', beats: 1 },
  { value: '4t', label: '1/4 Triplet', beats: 2 / 3 },
  { value: '8n', label: '1/8 Eighth', beats: 0.5 },
  { value: '8t', label: '1/8 Triplet', beats: 1 / 3 },
  { value: '16n', label: '1/16 Sixteenth', beats: 0.25 },
  { value: '16t', label: '1/16 Triplet', beats: 1 / 6 },
] as const;
type NoteType = typeof NOTE_TYPES[number]['value'];

const initialSvg = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g"><stop stop-color="#ff3e78"/><stop offset=".18" stop-color="#ffb23e"/><stop offset=".36" stop-color="#e6e64c"/><stop offset=".54" stop-color="#40dba7"/><stop offset=".72" stop-color="#39a8ff"/><stop offset="1" stop-color="#a66aff"/></linearGradient></defs><rect width="640" height="360" fill="#111827"/><path d="M0 40 Q100 140 220 60 T430 100 T640 30 V360 H0Z" fill="url(#g)"/><circle cx="190" cy="200" r="80" fill="#ff4a9c" opacity=".65"/><circle cx="400" cy="230" r="110" fill="#39baff" opacity=".55"/></svg>`)}`;
const toDb = (percent: number) => 20 * Math.log10(Math.max(0.001, percent / 100));
const modeLabels: Record<AnalysisMode, string> = {
  'color-stripes': 'Color stripes',
  'line-to-follow': 'Line to Follow',
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

export default function App() {
  const [imageUrl, setImageUrl] = useState<string | null>(initialSvg);
  const [rotation, setRotation] = useState(0);
  const [steps, setSteps] = useState(16);
  const [drumSteps, setDrumSteps] = useState(16);
  const [drumThreshold, setDrumThreshold] = useState(DEFAULT_DRUM_THRESHOLD);
  const [noteType, setNoteType] = useState<NoteType>('16n');
  const [bpm, setBpm] = useState(112);
  const [bpmInput, setBpmInput] = useState('112');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('color-stripes');
  const [pitchSource, setPitchSource] = useState<PitchSource>('hue');
  const [durationSource, setDurationSource] = useState<DurationSource>('brightness');
  const [volumeSource, setVolumeSource] = useState<VolumeSource>('brightness');
  const [targetHue, setTargetHue] = useState(330);
  const [hueTolerance, setHueTolerance] = useState(35);
  const [minSaturation, setMinSaturation] = useState(20);
  const [minBrightness, setMinBrightness] = useState(12);
  const [scale, setScale] = useState('Minor');
  const [root, setRoot] = useState('C');
  const [minMidi, setMinMidi] = useState(28);
  const [maxMidi, setMaxMidi] = useState(55);
  const [threshold, setThreshold] = useState(12);
  const [view, setView] = useState<'circle' | 'grid'>('circle');
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingFilename, setRecordingFilename] = useState('');
  const [savingRecording, setSavingRecording] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const drumPlayhead = useMemo(() => createPlayhead(0), []);
  const [status, setStatus] = useState('Ready · image analysis runs locally');
  const [volume, setVolume] = useState(75);
  const [synthVolume, setSynthVolume] = useState(75);
  const [drumVolume, setDrumVolume] = useState(75);
  const [features, setFeatures] = useState<ReturnType<typeof extractFeatures>>([]);
  const [events, setEvents] = useState<NoteEvent[]>([]);
  const [drumChannelVolumes, setDrumChannelVolumes] = useState<number[]>(() => Array(16).fill(100));
  const [drumSamplePaths, setDrumSamplePaths] = useState<string[]>(() => [...DEFAULT_DRUM_SAMPLE_PATHS]);
  const [padSections, setPadSections] = useState(6);
  const [padBars, setPadBars] = useState(2);
  const [padSensitivity, setPadSensitivity] = useState(30);
  const [padVolume, setPadVolume] = useState(65);
  const [padChords, setPadChords] = useState<PadChord[]>([]);
  const [activePadChord, setActivePadChord] = useState(0);
  const [padMedia, setPadMedia] = useState<{ kind: 'image' | 'video'; url: string; name: string } | null>(null);
  const [padTick, setPadTick] = useState(0);
  const padFileRef = useRef<HTMLInputElement | null>(null);
  const padPixelsRef = useRef<ImagePixels | null>(null);
  const padFramesRef = useRef<ImagePixels[] | null>(null);
  const mainPixelsRef = useRef<ImagePixels | null>(null);
  const [drumPattern, setDrumPattern] = useState<DrumPattern>(() => createEmptyDrumPattern(16));
  const [audioEngine, setAudioEngine] = useState<AudioEngine | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const drumFileRef = useRef<HTMLInputElement | null>(null);
  const drumPixelsRef = useRef<ReturnType<typeof getPixels> | null>(null);
  const [drumImageName, setDrumImageName] = useState<string | null>(null);
  const [drumImageUrl, setDrumImageUrl] = useState<string | null>(null);
  const rootMidi = NOTE_NAMES.indexOf(root) + 36;
  const stepBeats = NOTE_TYPES.find(option => option.value === noteType)?.beats ?? 0.25;

  const analyze = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
    const pixels = getPixels(canvas);
    mainPixelsRef.current = pixels;
    setPadTick(tick => tick + 1);
    const found = extractFeatures(pixels, steps, {
      mode: analysisMode,
      targetHue,
      hueTolerance,
      minSaturation: minSaturation / 100,
      minBrightness: minBrightness / 100,
    });
    setFeatures(found);
    const mapped = mapFeaturesToEvents(found, {
      pitchSource, durationSource, volumeSource, rootMidi, scale,
      minMidi, maxMidi, threshold, steps, stepBeats, analysisMode,
    });
    setEvents(mapped);
    const mappedDrums = analyzeImageToDrumPattern(drumPixelsRef.current ?? pixels, drumSteps, drumThreshold);
    setDrumPattern(mappedDrums);
    setActiveStep(current => Math.min(current, steps - 1));
    drumPlayhead.set(Math.min(drumPlayhead.get(), drumSteps - 1));
    setStatus(`Analyzed image · synth ${mapped.filter(event => event.active).length}/${steps} · drums ${mappedDrums.hits.filter(hit => hit.active).length}`);
  }, [steps, drumSteps, stepBeats, analysisMode, targetHue, hueTolerance, minSaturation, minBrightness, pitchSource, durationSource, volumeSource, rootMidi, scale, minMidi, maxMidi, threshold, drumThreshold]);

  const onCanvas = useCallback((canvas: HTMLCanvasElement) => analyze(canvas), [analyze]);

  useEffect(() => {
    const engine = new AudioEngine();
    engineRef.current = engine;
    setAudioEngine(engine);
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);
  useEffect(() => setBpmInput(String(bpm)), [bpm]);
  useEffect(() => {
    engineRef.current?.setMasterVolume(toDb(volume));
  }, [volume, audioEngine]);
  useEffect(() => {
    engineRef.current?.setSynthVolume(toDb(synthVolume));
  }, [synthVolume, audioEngine]);
  useEffect(() => {
    engineRef.current?.setDrumVolume(drumVolume / 100);
  }, [drumVolume, audioEngine]);
  useEffect(() => {
    drumChannelVolumes.forEach((value, channel) => engineRef.current?.setDrumChannelVolume(channel, value / 100));
  }, [drumChannelVolumes, audioEngine]);
  useEffect(() => {
    drumSamplePaths.forEach((url, channel) => engineRef.current?.setDrumSample(channel, url));
  }, [drumSamplePaths, audioEngine]);
  useEffect(() => {
    engineRef.current?.setPadVolume(padVolume / 100);
  }, [padVolume, audioEngine]);
  useEffect(() => {
    const settings = { rootMidi, scale, baseBars: padBars, sensitivity: padSensitivity };
    const frames = padFramesRef.current;
    const pixels = padPixelsRef.current ?? mainPixelsRef.current;
    if (frames) setPadChords(framesToPadChords(Array.from({ length: padSections }, (_, i) => frames[Math.floor(((i + 0.5) / padSections) * frames.length)]), settings));
    else if (pixels) setPadChords(imageToPadChords(pixels, padSections, settings));
    setActivePadChord(0);
  }, [padSections, padBars, padSensitivity, rootMidi, scale, padTick, padMedia]);
  useEffect(() => {
    if (playing) {
      engineRef.current?.setPattern({
        synthEvents: events,
        drumPattern,
        bpm,
        onStep: setActiveStep,
        onDrumStep: drumPlayhead.set,
        stepNotation: noteType,
        padChords,
        onPadChord: setActivePadChord,
      });
    }
  }, [events, drumPattern, padChords, bpm, noteType, playing]);
  useEffect(() => {
    if (drumPixelsRef.current) setDrumPattern(analyzeImageToDrumPattern(drumPixelsRef.current, drumSteps, drumThreshold));
  }, [drumSteps, drumThreshold]);

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus('Please select an image file.');
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(old => {
      if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
      return url;
    });
    setRotation(0);
    setStatus(`Loaded ${file.name}`);
  };

  const handleDrumFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus('Please select an image file.');
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d')?.drawImage(image, 0, 0);
      drumPixelsRef.current = getPixels(canvas);
      const pattern = analyzeImageToDrumPattern(drumPixelsRef.current, drumSteps, drumThreshold);
      setDrumPattern(pattern);
      setDrumImageName(file.name);
      setDrumImageUrl(old => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      setStatus(`Drum rhythm built from ${file.name} · ${pattern.hits.filter(hit => hit.active).length} hits`);
    };
    image.onerror = () => {
      setStatus('Could not read that image.');
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };
  const useMainImageForDrums = () => {
    drumPixelsRef.current = null;
    setDrumImageName(null);
    setDrumImageUrl(old => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    if (canvasRef.current) analyze(canvasRef.current);
  };

  const clearPadMedia = (revoke = true) => {
    padPixelsRef.current = null;
    padFramesRef.current = null;
    setPadMedia(old => {
      if (old && revoke) URL.revokeObjectURL(old.url);
      return null;
    });
  };
  const handlePadFile = async (file?: File) => {
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    if (!isVideo && !file.type.startsWith('image/')) {
      setStatus('Please select an image or video file.');
      return;
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      setStatus('Video is too large — use a clip under 60 MB.');
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      if (isVideo) {
        setStatus('Reading video frames…');
        const { frames } = await extractVideoFrames(url, 12);
        padFramesRef.current = frames;
        padPixelsRef.current = null;
      } else {
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('Could not read that image.'));
          image.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext('2d')?.drawImage(image, 0, 0);
        padPixelsRef.current = getPixels(canvas);
        padFramesRef.current = null;
      }
      setPadMedia(old => {
        if (old) URL.revokeObjectURL(old.url);
        return { kind: isVideo ? 'video' : 'image', url, name: file.name };
      });
      setStatus(`Pad chords built from ${file.name}`);
    } catch (error) {
      URL.revokeObjectURL(url);
      setStatus(error instanceof Error ? error.message : 'Could not read that file.');
    }
  };

  const play = async () => {
    if (!events.length || !engineRef.current) return;
    try {
      engineRef.current.setPattern({
        synthEvents: events,
        drumPattern,
        bpm,
        onStep: setActiveStep,
        onDrumStep: drumPlayhead.set,
        stepNotation: noteType,
        padChords,
        onPadChord: setActivePadChord,
      });
      await engineRef.current.play();
      setPlaying(true);
      setStatus('Playing · audio scheduled on the Web Audio clock');
    } catch (error) {
      setStatus(`Audio could not start: ${String(error)}`);
    }
  };
  const stop = () => {
    engineRef.current?.stop();
    setPlaying(false);
    setActiveStep(0);
    drumPlayhead.set(0);
    setActivePadChord(0);
    setStatus('Playback stopped');
  };
  const handleRecording = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!recording) {
      try {
        await engine.startRecording();
        setRecording(true);
        setStatus('Recording master output');
      } catch (error) {
        setStatus(error instanceof Error ? error.message : `Could not start recording: ${String(error)}`);
      }
      return;
    }
    try {
      const blob = await engine.stopRecording();
      const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      setRecordingBlob(blob);
      setRecordingFilename(`image-music-recording-${timestamp}.${extension}`);
      setRecording(false);
      setStatus('Recording stopped · choose a filename and save location');
    } catch (error) {
      setRecording(false);
      setStatus(error instanceof Error ? error.message : `Could not stop recording: ${String(error)}`);
    }
  };
  const saveRecording = async () => {
    if (!recordingBlob || !recordingFilename.trim()) return;
    setSavingRecording(true);
    try {
      const fileName = recordingFilename.trim().replace(/[<>:"/\\|?*]/g, '-');
      const pickerWindow = window as SaveFilePickerWindow;
      if (pickerWindow.showSaveFilePicker) {
        const fileHandle = await pickerWindow.showSaveFilePicker({ suggestedName: fileName });
        const writable = await fileHandle.createWritable();
        await writable.write(recordingBlob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(recordingBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setRecordingBlob(null);
      setStatus(`Saved ${fileName}`);
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setStatus(error instanceof Error ? error.message : `Could not save recording: ${String(error)}`);
      }
    } finally {
      setSavingRecording(false);
    }
  };
  const commitBpm = () => {
    const parsed = Number(bpmInput);
    const next = bpmInput.trim() && Number.isFinite(parsed)
      ? Math.round(Math.max(40, Math.min(200, parsed)))
      : bpm;
    setBpm(next);
    setBpmInput(String(next));
  };
  const updateEvent = (key: 'pitch' | 'duration' | 'velocity' | 'active', value: number | boolean) => {
    setEvents(current => current.map(event => event.step === activeStep ? { ...event, [key]: value } : event));
  };
  const toggleDrumHit = useCallback((channel: number, step: number) => {
    setDrumPattern(current => ({
      ...current,
      hits: current.hits.map(hit => hit.channel === channel && hit.step === step ? { ...hit, active: !hit.active } : hit),
    }));
  }, []);
  const selected = events[activeStep];
  const noteSummary = useMemo(
    () => events.map(event => `${event.step + 1}:${midiName(event.pitch)} ${event.active ? '●' : '○'}`).join(' · '),
    [events],
  );
  const activeDrumHits = useMemo(() => drumPattern.hits.filter(hit => hit.active).length, [drumPattern]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Waves size={20} /></div><div><b>IMAGE MUSIC</b><span>STATION / PROTOTYPE 002</span></div></div>
        <div className="top-status"><span className="status-dot" />{status}</div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={event => handleFile(event.target.files?.[0])} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={event => handleFile(event.target.files?.[0])} />
      </header>

      <section className="transport-panel">
        <div className="transport-buttons">
          <button className="play-button" onClick={playing ? stop : play}>
            {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}{playing ? 'STOP' : 'PLAY'}
          </button>
          <button className="secondary-button" onClick={() => setRotation(value => (value + 270) % 360)} title="Rotate counterclockwise"><RotateCcw size={16} /></button>
          <button className="secondary-button" onClick={() => setRotation(value => (value + 90) % 360)} title="Rotate clockwise"><RotateCw size={16} /></button>
        </div>
        <div className="transport-field">
          <label>MASTER / TRACK BPM</label>
          <div className="bpm-control">
            <button aria-label="Decrease BPM" onClick={() => setBpm(value => Math.max(40, value - 1))}>−</button>
            <input aria-label="Tempo in beats per minute" type="number" min="40" max="200" step="1" value={bpmInput} onChange={event => setBpmInput(event.target.value)} onBlur={commitBpm} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setBpmInput(String(bpm)); }} />
            <button aria-label="Increase BPM" onClick={() => setBpm(value => Math.min(200, value + 1))}>+</button><span>BPM</span>
          </div>
        </div>
        <div className="mixer">
          <div className="mixer-channel"><label>SYNTH</label><input aria-label="Synth track volume" type="range" min="0" max="100" value={synthVolume} onChange={event => setSynthVolume(Number(event.target.value))} /><span>{synthVolume}%</span></div>
          <div className="mixer-channel"><label>DRUMS</label><input aria-label="Drum track volume" type="range" min="0" max="100" value={drumVolume} onChange={event => setDrumVolume(Number(event.target.value))} /><span>{drumVolume}%</span></div>
          <div className="mixer-channel"><label>PADS</label><input aria-label="Pad track volume" type="range" min="0" max="100" value={padVolume} onChange={event => setPadVolume(Number(event.target.value))} /><span>{padVolume}%</span></div>
          <div className="mixer-channel master"><label><Volume2 size={11} /> MASTER</label><input aria-label="Master volume" type="range" min="0" max="100" value={volume} onChange={event => setVolume(Number(event.target.value))} /><span>{volume}%</span></div>
          <button
            className={`record-button${recording ? ' is-recording' : ''}`}
            aria-label={recording ? 'Stop recording' : 'Start recording'}
            title={recording ? 'Stop recording' : 'Record master output'}
            onClick={() => { void handleRecording(); }}
          >
            {recording ? <Square size={14} fill="currentColor" /> : <Circle size={14} fill="currentColor" />}
            {recording ? 'STOP REC' : 'REC'}
          </button>
        </div>
      </section>
      {recordingBlob && (
        <div className="recording-modal-backdrop">
          <section className="recording-modal" role="dialog" aria-modal="true" aria-labelledby="recording-title">
            <div className="recording-modal-heading">
              <div><span className="eyebrow">MASTER RECORDING</span><h2 id="recording-title">Save recording</h2></div>
              <button className="icon-button" aria-label="Cancel save" onClick={() => setRecordingBlob(null)}><X size={16} /></button>
            </div>
            <label className="recording-filename-label" htmlFor="recording-filename">FILE NAME</label>
            <input
              id="recording-filename"
              className="recording-filename"
              value={recordingFilename}
              onChange={event => setRecordingFilename(event.target.value)}
              autoFocus
            />
            <p className="control-hint">Choose a local folder in the save dialog. If your browser does not support a save dialog, the file is downloaded to its configured downloads location.</p>
            <div className="recording-modal-actions">
              <button className="secondary-button" onClick={() => setRecordingBlob(null)}>Cancel</button>
              <button className="export-button" disabled={savingRecording || !recordingFilename.trim()} onClick={() => { void saveRecording(); }}>
                <Download size={15} />{savingRecording ? 'Saving…' : 'Choose location & save'}
              </button>
            </div>
          </section>
        </div>
      )}

      <div className="track-stack"><div className="track-viewport"><div className="workspace">
        <section className="panel image-panel">
          <div className="panel-heading"><div><span className="eyebrow">01 / SOURCE + MAPPING</span><h2>Image &amp; controls</h2></div><span className="live-tag">LOCAL</span></div>
          <div className="image-panel-layout">
            <div className="image-source-column">
              <div className="image-stage">
                {imageUrl ? <ImageEditor imageUrl={imageUrl} rotation={rotation} onCanvas={onCanvas} /> : <button className="upload-placeholder" onClick={() => fileRef.current?.click()}><ImagePlus size={32} /><span>Choose an image</span><small>JPG · PNG · WEBP</small></button>}
              </div>
              <div className="image-actions"><button className="secondary-button" onClick={() => fileRef.current?.click()}><ImagePlus size={15} /> Upload file</button><button className="secondary-button" onClick={() => cameraRef.current?.click()}><Camera size={15} /> Camera</button></div>
              <p className="help-text">Image processing stays in this browser; no upload to a server.</p>
            </div>
            <div className="image-mapping-column">
              <div className="control-group"><label>ANALYSIS MODE</label><select value={analysisMode} onChange={event => setAnalysisMode(event.target.value as AnalysisMode)}>{Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><p className="control-hint">{analysisMode === 'color-stripes' ? 'Average color features from vertical image stripes.' : 'Follow a target-colored line; position, area, and tangent are measured per step.'}</p></div>
              <div className="control-group"><label>PITCH SOURCE</label><select value={pitchSource} onChange={event => setPitchSource(event.target.value as PitchSource)}>{[['hue', 'Color hue'], ['brightness', 'Brightness'], ['vertical', 'Scan position'], ['edge', 'Edge strength'], ['object-position', 'Detected object position'], ...(analysisMode === 'line-to-follow' ? [['line-position', 'Line position'], ['line-area', 'Area under line'], ['line-tangent', 'Tangent angle']] : [])].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="control-group"><label>DURATION SOURCE</label><select value={durationSource} onChange={event => setDurationSource(event.target.value as DurationSource)}>{[['brightness', 'Brightness'], ['saturation', 'Saturation'], ['edge', 'Edge strength'], ['object-size', 'Detected object size'], ['fixed', 'Fixed duration'], ...(analysisMode === 'line-to-follow' ? [['line-position', 'Line position'], ['line-area', 'Area under line'], ['line-tangent', 'Tangent angle']] : [])].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="control-group"><label>VOLUME / VELOCITY SOURCE</label><select value={volumeSource} onChange={event => setVolumeSource(event.target.value as VolumeSource)}>{[['brightness', 'Brightness'], ['saturation', 'Saturation'], ['edge', 'Edge strength'], ['fixed', 'Fixed volume'], ...(analysisMode === 'line-to-follow' ? [['line-position', 'Line position'], ['line-area', 'Area under line'], ['line-tangent', 'Tangent angle']] : [])].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              {analysisMode === 'line-to-follow' && <>
                <div className="control-group"><div className="label-row"><label>TARGET HUE</label><b>{targetHue}°</b></div><input className="full-range" type="range" min="0" max="359" value={targetHue} onChange={event => setTargetHue(Number(event.target.value))} /></div>
                <div className="control-group"><div className="label-row"><label>HUE TOLERANCE</label><b>±{hueTolerance}°</b></div><input className="full-range" type="range" min="5" max="90" value={hueTolerance} onChange={event => setHueTolerance(Number(event.target.value))} /></div>
                <div className="control-group"><div className="label-row"><label>MIN SATURATION</label><b>{minSaturation}%</b></div><input className="full-range" type="range" min="0" max="100" value={minSaturation} onChange={event => setMinSaturation(Number(event.target.value))} /></div>
                <div className="control-group"><div className="label-row"><label>MIN BRIGHTNESS</label><b>{minBrightness}%</b></div><input className="full-range" type="range" min="0" max="100" value={minBrightness} onChange={event => setMinBrightness(Number(event.target.value))} /></div>
              </>}
            </div>
            <div className="image-pitch-column">
              <div className="subsection-heading pitch-feature-heading"><span className="eyebrow">FEATURE PREVIEW</span><span className="count-pill">{features.length} FEATURES</span></div>
              <div className="feature-preview">{features.map(feature => <div key={feature.step} title={`Step ${feature.step + 1}: hue ${Math.round(feature.hue)}°, brightness ${Math.round(feature.brightness * 100)}%, edge ${Math.round((feature.edge ?? 0) * 100)}%`} style={{ background: `hsl(${feature.hue} ${Math.max(12, feature.saturation * 100)}% ${Math.max(12, feature.brightness * 100)}%)` }} />)}</div>
              <div className="control-group pitch-threshold-control"><div className="label-row"><label>ACTIVE THRESHOLD</label><b>{threshold}%</b></div><input className="full-range" type="range" min="0" max="100" value={threshold} onChange={event => setThreshold(Number(event.target.value))} /></div>
              <div className="pitch-select-grid">
                <div className="control-group"><label>ROOT NOTE</label><select value={root} onChange={event => setRoot(event.target.value)}>{NOTE_NAMES.map(note => <option key={note} value={note}>{note}</option>)}</select></div>
                <div className="control-group"><label>SCALE</label><select value={scale} onChange={event => setScale(event.target.value)}>{Object.keys(SCALES).map(name => <option key={name} value={name}>{name}</option>)}</select></div>
              </div>
              <div className="pitch-range-grid">
                <div className="control-group"><div className="label-row"><label>LOWEST NOTE</label><b>{midiName(minMidi)}</b></div><input className="full-range" type="range" min="24" max="60" value={minMidi} onChange={event => setMinMidi(Math.min(Number(event.target.value), maxMidi - 1))} /></div>
                <div className="control-group"><div className="label-row"><label>HIGHEST NOTE</label><b>{midiName(maxMidi)}</b></div><input className="full-range" type="range" min="36" max="84" value={maxMidi} onChange={event => setMaxMidi(Math.max(Number(event.target.value), minMidi + 1))} /></div>
              </div>
              <button className="regenerate-button" onClick={() => canvasRef.current && analyze(canvasRef.current)}><Refresh size={15} /> Re-analyze</button>
            </div>
          </div>
        </section>

        <section className="panel sequencer-panel">
          <div className="panel-heading sequencer-heading">
            <div><span className="eyebrow">02 / SEQUENCER</span><h2>Generated sequence</h2></div>
            <div className="sequencer-toolbar">
              <label className="sequencer-setting"><span>STEPS</span><select value={steps} onChange={event => setSteps(Number(event.target.value))}>{STEP_OPTIONS.map(count => <option key={count} value={count}>{count}</option>)}</select></label>
              <label className="sequencer-setting note-setting"><span>STEP NOTE</span><select value={noteType} onChange={event => setNoteType(event.target.value as NoteType)}>{NOTE_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <div className="view-switch"><button className={view === 'circle' ? 'selected' : ''} onClick={() => setView('circle')}>Circle</button><button className={view === 'grid' ? 'selected' : ''} onClick={() => setView('grid')}>Grid</button></div>
              <button className="export-button" onClick={() => downloadMidi(events, bpm, stepBeats)}><Download size={15} /> Export MIDI</button>
            </div>
          </div>
          <div className="sequencer-body">
            <div className="sequencer-stage">{view === 'circle' ? <CircularSequencer events={events} activeStep={activeStep} onSelect={setActiveStep} /> : <StepGrid events={events} activeStep={activeStep} onSelect={setActiveStep} />}</div>
            <div className="sequencer-legend"><span><i className="legend-on" /> Active step</span><span><i className="legend-off" /> Rest / disabled</span><span>Select a step to edit it below</span></div>
            {selected && <div className="step-editor">
              <div className="subsection-heading"><span className="eyebrow">EDIT STEP {activeStep + 1}</span><span className="count-pill">{midiName(selected.pitch)}</span></div>
              <div className="editor-row"><label>Pitch</label><b>{midiName(selected.pitch)} · MIDI {selected.pitch}</b></div><input aria-label="Step pitch" className="full-range" type="range" min={minMidi} max={maxMidi} value={selected.pitch} onChange={event => updateEvent('pitch', Number(event.target.value))} />
              <div className="editor-row"><label>Duration</label><b>{selected.duration.toFixed(2)} beats</b></div><input aria-label="Step duration" className="full-range" type="range" min=".03" max="1" step=".01" value={selected.duration} onChange={event => updateEvent('duration', Number(event.target.value))} />
              <div className="editor-row"><label>Volume / velocity</label><b>{Math.round(selected.velocity * 100)}%</b></div><input aria-label="Step velocity" className="full-range" type="range" min="0" max="1" step=".01" value={selected.velocity} onChange={event => updateEvent('velocity', Number(event.target.value))} />
              <div className="editor-actions"><button className={selected.active ? 'selected-step-button' : 'secondary-button'} onClick={() => updateEvent('active', !selected.active)}>{selected.active ? '● Step active' : '○ Step muted'}</button><button className="secondary-button" onClick={() => { if (features.length) { const fresh = mapFeaturesToEvents(features, { pitchSource, durationSource, volumeSource, rootMidi, scale, minMidi, maxMidi, threshold, steps, stepBeats, analysisMode })[activeStep]; setEvents(current => current.map(event => event.step === activeStep ? fresh : event)); } }}>Reset step</button></div>
            </div>}
            <div className="sequencer-summary"><div className="subsection-heading"><span className="eyebrow">EVENT SUMMARY</span><span className="count-pill">{events.filter(event => event.active).length} / {steps} ACTIVE</span></div><div className="event-list">{noteSummary || 'Upload an image to generate notes.'}</div></div>
          </div>
        </section>
        <AudioControlPanel engine={audioEngine} playing={playing} />
      </div></div>
      <div className="track-viewport"><div className="workspace drum-workspace">
        <section className="panel drum-source-panel">
          <div className="panel-heading"><div><span className="eyebrow">01 / IMAGE → DRUM RHYTHM</span><h2>Drum analysis</h2></div><span className="count-pill">{drumPattern.channels.filter(channel => channel.hits > 0).length} COLORS</span></div>
          <p className="control-hint">The image is scanned left to right; colored islands are grouped into 16 hue bands, each mapped to one drum sound.</p>
          <div className="control-group"><div className="label-row"><label>DRUM THRESHOLD</label><b>{drumThreshold}%</b></div><input className="full-range" type="range" min="0" max="100" value={drumThreshold} onChange={event => setDrumThreshold(Number(event.target.value))} /></div>
          <div className="drum-legend">{drumPattern.channels.map(channel => <span key={channel.index}><i style={{ background: channel.color, opacity: channel.hits ? 1 : .3 }} />{channel.name}</span>)}</div>
          <div className="drum-image-source">
            {(drumImageUrl ?? imageUrl) ? <img src={(drumImageUrl ?? imageUrl) as string} alt="Drum image source" style={drumImageUrl ? undefined : { transform: `rotate(${rotation}deg)` }} /> : <span>No image</span>}
          </div>
          <div className="drum-upload">
            <button className="secondary-button" onClick={() => drumFileRef.current?.click()}><ImagePlus size={15} /> Upload file</button>
            {drumImageName && <button className="secondary-button" onClick={useMainImageForDrums}>Use main image</button>}
            <small>{drumImageName ?? 'Using the main image'}</small>
          </div>
          <input ref={drumFileRef} type="file" accept="image/*" hidden onChange={event => { handleDrumFile(event.target.files?.[0]); event.target.value = ''; }} />
          <button className="regenerate-button" onClick={() => drumPixelsRef.current ? setDrumPattern(analyzeImageToDrumPattern(drumPixelsRef.current, drumSteps, drumThreshold)) : canvasRef.current && analyze(canvasRef.current)}><Refresh size={15} /> Rebuild drum rhythm</button>
        </section>
        <section className="panel drum-seq-panel">
          <div className="panel-heading"><div><span className="eyebrow">02 / DRUM SEQUENCER · 16 CHANNELS</span><h2>Drum rack</h2></div><div className="sequencer-toolbar"><span className="count-pill">{activeDrumHits} ACTIVE HITS</span><label className="sequencer-setting"><span>STEPS</span><select value={drumSteps} onChange={event => setDrumSteps(Number(event.target.value))}>{DRUM_STEP_OPTIONS.map(count => <option key={count} value={count}>{count}</option>)}</select></label></div></div>
          <DrumRackGrid
            pattern={drumPattern}
            playhead={drumPlayhead}
            onToggle={toggleDrumHit}
            samplePaths={drumSamplePaths}
            onSampleChange={(channel, url) => setDrumSamplePaths(current => current.map((sample, index) => index === channel ? url : sample))}
          />
        </section>
        <DrumMixer
          channels={drumPattern.channels}
          volumes={drumChannelVolumes}
          onChange={(channel, value) => setDrumChannelVolumes(current => current.map((item, index) => index === channel ? value : item))}
          onReset={() => setDrumChannelVolumes(Array(16).fill(100))}
        />
      </div></div>
      <div className="track-viewport"><div className="workspace drum-workspace">
        <section className="panel pad-source-panel">
          <div className="panel-heading"><div><span className="eyebrow">01 / IMAGE or VIDEO → PAD CHORDS</span><h2>Pad analysis</h2></div><span className="count-pill">{padChords.length} CHORDS</span></div>
          <p className="control-hint">The image is split left to right (a video is sampled over time). Each section's dominant hue picks a chord in the chosen scale; saturation adds chord tones, dark sections last longer.</p>
          <div className="pad-settings">
            <label className="sequencer-setting"><span>SECTIONS</span><select value={padSections} onChange={event => setPadSections(Number(event.target.value))}>{PAD_SECTION_OPTIONS.map(count => <option key={count} value={count}>{count}</option>)}</select></label>
            <label className="sequencer-setting"><span>BARS / SECTION</span><select value={padBars} onChange={event => setPadBars(Number(event.target.value))}>{PAD_BAR_OPTIONS.map(count => <option key={count} value={count}>{count}</option>)}</select></label>
          </div>
          <div className="control-group"><div className="label-row"><label>COLOR SENSITIVITY</label><b>{padSensitivity}%</b></div><input className="full-range" type="range" min="0" max="100" value={padSensitivity} onChange={event => setPadSensitivity(Number(event.target.value))} /></div>
          <div className="drum-image-source pad-image-source">
            {padMedia?.kind === 'video' ? <video src={padMedia.url} muted loop autoPlay playsInline />
              : (padMedia?.url ?? imageUrl) ? <img src={(padMedia?.url ?? imageUrl) as string} alt="Pad source" style={padMedia ? undefined : { transform: `rotate(${rotation}deg)` }} /> : <span>No image</span>}
          </div>
          <div className="drum-upload">
            <button className="secondary-button" onClick={() => padFileRef.current?.click()}><ImagePlus size={15} /> Upload image / video</button>
            {padMedia && <button className="secondary-button" onClick={() => clearPadMedia()}>Use main image</button>}
            <small>{padMedia?.name ?? 'Using the main image'}</small>
          </div>
          <input ref={padFileRef} type="file" accept="image/*,video/*" hidden onChange={event => { void handlePadFile(event.target.files?.[0]); event.target.value = ''; }} />
        </section>
        <section className="panel pad-chords-panel">
          <div className="panel-heading"><div><span className="eyebrow">02 / AMBIENT PAD · CONTINUOUS</span><h2>Chord timeline</h2></div><span className="count-pill">{padChords.reduce((sum, chord) => sum + chord.bars, 0)} BARS LOOP</span></div>
          <PadChordStrip chords={padChords} activeChord={activePadChord} />
        </section>
        <PadControlPanel engine={audioEngine} playing={playing} />
      </div></div>
      </div>
      <footer className="footer"><span>IMAGE MUSIC STATION <b>0.2.0</b></span><span>REACT · TONE.JS · CANVAS · MIDI</span><span>LOCAL IMAGE ANALYSIS</span></footer>
    </main>
  );
}