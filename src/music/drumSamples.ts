export type DrumSampleCategory = 'kicks' | 'snares' | 'claps' | 'hats' | 'percs' | 'cymbals' | 'fx';

export type DrumSampleOption = {
  url: string;
  label: string;
};

const sampleFiles: Record<DrumSampleCategory, string[]> = {
  kicks: [
    'bounce-808-808-bass-long.wav',
    'bounce-808-808-bass-punch.wav',
    'bounce-808-808-round-long.wav',
    'bounce-kick-bounce-kick-01.wav',
    'bounce-kick-bounce-kick-02.wav',
    'bounce-kick-bounce-kick-03.wav',
    'hard-trap-808-808-bass-dist.wav',
    'hard-trap-808-808-bass-sub.wav',
    'hard-trap-808-808-dist-long.wav',
    'hard-trap-kick-hard-kick-01.wav',
    'hard-trap-kick-hard-kick-02.wav',
    'hard-trap-kick-hard-kick-03.wav',
    'punch-01.wav',
    'soulful-vintage-808-808-bass-lofi.wav',
    'soulful-vintage-808-808-lofi.wav',
    'soulful-vintage-kick-vintage-kick-01.wav',
    'soulful-vintage-kick-vintage-kick-02.wav',
    'soulful-vintage-kick-vintage-kick-03.wav',
    'sub-01.wav',
  ],
  snares: [
    'body-01.wav',
    'bounce-snare-bounce-snare-01.wav',
    'bounce-snare-bounce-snare-02.wav',
    'bounce-snare-bounce-snare-03.wav',
    'hard-trap-snare-hard-snare-01.wav',
    'hard-trap-snare-hard-snare-02.wav',
    'hard-trap-snare-hard-snare-03.wav',
    'soulful-vintage-snare-vintage-snare-01.wav',
    'soulful-vintage-snare-vintage-snare-02.wav',
    'soulful-vintage-snare-vintage-snare-03.wav',
  ],
  claps: [
    'bounce-clap-clap-01.wav',
    'bounce-clap-cp.wav',
    'classic-01.wav',
    'hard-trap-clap-cl.wav',
    'hard-trap-clap-clap-01.wav',
    'soulful-vintage-clap-cl-lofi.wav',
    'soulful-vintage-clap-vintage-clap-01.wav',
  ],
  hats: [
    'bounce-hi-hat-hi-hat-closed-01.wav',
    'bounce-open-hat-open-hat-01.wav',
    'closed-01.wav',
    'hard-trap-hi-hat-ch.wav',
    'hard-trap-hi-hat-hi-hat-closed-01.wav',
    'hard-trap-open-hat-open-hat-01.wav',
    'open-01.wav',
    'soulful-vintage-hi-hat-ch-lofi.wav',
    'soulful-vintage-hi-hat-hi-hat-closed-01.wav',
    'soulful-vintage-open-hat-oh00-lofi.wav',
    'soulful-vintage-open-hat-open-hat-01.wav',
  ],
  percs: [
    'blip-01.wav',
    'blip-02.wav',
    'bounce-perc-lt25.wav',
    'bounce-perc-perc-high-tom.wav',
    'bounce-perc-perc-low-tom.wav',
    'hard-trap-perc-perc-cowbell.wav',
    'hard-trap-perc-perc-low-tom.wav',
    'hard-trap-perc-perc-rimshot.wav',
    'shaker-01.wav',
    'soulful-vintage-perc-ht00-lofi.wav',
    'soulful-vintage-perc-lt00-lofi.wav',
    'soulful-vintage-perc-perc-high-tom.wav',
    'soulful-vintage-perc-perc-low-tom.wav',
    'soulful-vintage-perc-perc-maraca.wav',
    'tick-01.wav',
    'tom-01.wav',
    'tom-02.wav',
    'tom-03.wav',
  ],
  cymbals: ['crash-01.wav', 'ride-01.wav'],
  fx: [
    'bounce-fx-fx-cymbal.wav',
    'hard-trap-fx-cy5075.wav',
    'hard-trap-fx-fx-cymbal.wav',
    'noise-01.wav',
    'soulful-vintage-fx-cy0000-lofi.wav',
    'soulful-vintage-fx-fx-cymbal.wav',
  ],
};

const KIT_NAMES: Record<string, string> = {
  'hard-trap': 'Hard Trap',
  bounce: 'Bounce',
  'soulful-vintage': 'Soulful Vintage',
};

const ROLE_PREFIXES: Record<DrumSampleCategory, string[]> = {
  kicks: ['kick-', '808-'],
  snares: ['snare-'],
  claps: ['clap-'],
  hats: ['hi-hat-', 'open-hat-'],
  percs: ['perc-'],
  cymbals: ['crash-', 'ride-'],
  fx: ['fx-'],
};

function sampleLabel(category: DrumSampleCategory, file: string) {
  const kitPrefix = Object.keys(KIT_NAMES).find(prefix => file.startsWith(`${prefix}-`));
  let name = kitPrefix ? file.slice(kitPrefix.length + 1) : file;
  const rolePrefix = ROLE_PREFIXES[category].find(prefix => name.startsWith(prefix));
  if (rolePrefix) name = name.slice(rolePrefix.length);
  name = name.replace(/\.wav$/i, '').replace(/-/g, ' ');
  const formattedName = name.replace(/\b\w/g, character => character.toUpperCase());
  return `${kitPrefix ? KIT_NAMES[kitPrefix] : 'Octal'} · ${formattedName}`;
}

function createSampleOptions(category: DrumSampleCategory): DrumSampleOption[] {
  return sampleFiles[category].map(file => ({
    url: `/drums/${category}/${file}`,
    label: sampleLabel(category, file),
  }));
}

export const DRUM_SAMPLE_OPTIONS: Record<DrumSampleCategory, DrumSampleOption[]> = {
  kicks: createSampleOptions('kicks'),
  snares: createSampleOptions('snares'),
  claps: createSampleOptions('claps'),
  hats: createSampleOptions('hats'),
  percs: createSampleOptions('percs'),
  cymbals: createSampleOptions('cymbals'),
  fx: createSampleOptions('fx'),
};

export const DEFAULT_DRUM_SAMPLE_PATHS = [
  '/drums/kicks/punch-01.wav',
  '/drums/kicks/sub-01.wav',
  '/drums/snares/body-01.wav',
  '/drums/claps/classic-01.wav',
  '/drums/hats/closed-01.wav',
  '/drums/hats/open-01.wav',
  '/drums/percs/tick-01.wav',
  '/drums/percs/tom-01.wav',
  '/drums/percs/tom-02.wav',
  '/drums/percs/tom-03.wav',
  '/drums/percs/shaker-01.wav',
  '/drums/percs/blip-01.wav',
  '/drums/percs/blip-02.wav',
  '/drums/cymbals/ride-01.wav',
  '/drums/cymbals/crash-01.wav',
  '/drums/fx/noise-01.wav',
];

export function getDrumSampleCategory(channel: number): DrumSampleCategory {
  if (channel <= 1) return 'kicks';
  if (channel === 2) return 'snares';
  if (channel === 3) return 'claps';
  if (channel <= 5) return 'hats';
  if (channel === 13 || channel === 14) return 'cymbals';
  if (channel === 15) return 'fx';
  return 'percs';
}
