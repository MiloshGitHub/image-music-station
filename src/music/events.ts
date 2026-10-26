export type Feature = {
  step: number; hue: number; brightness: number; saturation: number;
  edge?: number; position?: number; objectSize?: number; objectFound?: boolean;
  linePosition?: number; lineArea?: number; lineTangent?: number; lineFound?: boolean;
};
export type NoteEvent = {
  step: number; pitch: number; duration: number; velocity: number;
  probability: number; active: boolean;
};
export type AnalysisMode = 'color-stripes' | 'line-to-follow';
export type LineSource = 'line-position' | 'line-area' | 'line-tangent';
export type PitchSource = 'hue' | 'brightness' | 'vertical' | 'edge' | 'object-position' | LineSource;
export type DurationSource = 'brightness' | 'saturation' | 'fixed' | 'edge' | 'object-size' | LineSource;
export type VolumeSource = 'brightness' | 'saturation' | 'edge' | 'fixed' | LineSource;
export type MappingSettings = {
  pitchSource: PitchSource; durationSource: DurationSource; volumeSource?: VolumeSource;
  analysisMode?: AnalysisMode;
  rootMidi: number; scale: string; minMidi: number; maxMidi: number; threshold: number;
  steps: number; stepBeats: number;
};

export type DrumChannel = {
  index: number;
  name: string;
  color: string;
  hits: number;
};

export type DrumHit = {
  channel: number;
  step: number;
  active: boolean;
  velocity: number;
};

export type DrumPattern = {
  steps: number;
  channels: DrumChannel[];
  hits: DrumHit[];
};

export type PadChord = {
  index: number;
  degree: number;
  notes: number[];
  bars: number;
  velocity: number;
  color: string;
};
