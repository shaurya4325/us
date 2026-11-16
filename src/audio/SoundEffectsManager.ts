// Foley engine: real recorded CC0 sounds (Kenney RPG / Impact / Interface packs, OpenGameArt water splashes and
// our own kiss recordings), decoded once into Web Audio buffers. Every play picks a random variation and nudges the
// pitch 0.95x-1.05x so nothing ever sounds repetitive. A tiny synth only steps in if a file fails to load.
import { duckMusic } from './BiomeAudioManager';

const B = `${import.meta.env.BASE_URL}audio/sfx/`;
const seq = (dir: string, stem: string, n: number, pad = 3, from = 0, ext = 'ogg') => Array.from({ length: n }, (_, i) => `${dir}/${stem}${String(i + from).padStart(pad, '0')}.${ext}`);
const list = (dir: string, names: string[]) => names.map((n) => `${dir}/${n}`);

interface Bank { files: string[]; vol: number; rate?: [number, number]; duck?: number }
const BANKS: Record<string, Bank> = {
  // footsteps (surface-aware)
  'step:grass': { files: seq('impact', 'footstep_grass_', 5), vol: 0.32 },
  'step:wood': { files: seq('impact', 'footstep_wood_', 5), vol: 0.34 },
  'step:stone': { files: seq('impact', 'footstep_concrete_', 5), vol: 0.3 },
  'step:sand': { files: seq('impact', 'footstep_snow_', 5), vol: 0.3, rate: [1.05, 1.18] },
  'step:carpet': { files: seq('impact', 'footstep_carpet_', 5), vol: 0.36 },
  'step:water': { files: list('water', ['splash_03.ogg', 'splash_07.ogg', 'splash_09.ogg', 'splash_12.ogg']), vol: 0.14, rate: [1.1, 1.3] },
  swim: { files: list('water', ['splash_02.ogg', 'splash_05.ogg', 'splash_08.ogg']), vol: 0.16, rate: [0.85, 1] },
  // movement
  jump: { files: list('rpg', ['cloth1.ogg', 'cloth2.ogg', 'cloth3.ogg', 'cloth4.ogg']), vol: 0.35, rate: [1.1, 1.25] },
  land: { files: seq('impact', 'impactSoft_medium_', 5), vol: 0.28 },
  'land:wood': { files: seq('impact', 'impactPlank_medium_', 5), vol: 0.22 },
  swoosh: { files: list('rpg', ['cloth1.ogg', 'cloth3.ogg']), vol: 0.22, rate: [1.3, 1.5] },
  // gathering & crafting
  chop: { files: seq('impact', 'impactWood_medium_', 5), vol: 0.5 },
  chopHeavy: { files: list('rpg', ['chop.ogg']).concat(seq('impact', 'impactWood_heavy_', 5)), vol: 0.55 },
  clink: { files: seq('impact', 'impactMining_', 5), vol: 0.45 },
  crystal: { files: seq('impact', 'impactGlass_light_', 5), vol: 0.42 },
  pick: { files: list('ui', ['pluck_001.ogg', 'pluck_002.ogg']), vol: 0.5 },
  sickle: { files: list('rpg', ['knifeSlice.ogg', 'knifeSlice2.ogg']), vol: 0.32 },
  collect: { files: list('ui', ['drop_001.ogg', 'drop_002.ogg', 'drop_003.ogg']), vol: 0.32 },
  coins: { files: list('rpg', ['handleCoins.ogg', 'handleCoins2.ogg']), vol: 0.4 },
  catch: { files: list('ui', ['select_002.ogg', 'select_004.ogg']), vol: 0.45 },
  cast: { files: list('rpg', ['cloth2.ogg']), vol: 0.35, rate: [0.8, 0.9] },
  splash: { files: seq('water', 'splash_', 6, 2, 1), vol: 0.45 },
  sizzle: { files: list('rpg', ['metalPot1.ogg', 'metalPot2.ogg', 'metalPot3.ogg']), vol: 0.4 },
  anvil: { files: seq('impact', 'impactMetal_medium_', 5), vol: 0.42 },
  build: { files: seq('impact', 'impactPlank_medium_', 5), vol: 0.5 },
  scroll: { files: list('rpg', ['bookFlip1.ogg', 'bookFlip2.ogg', 'bookFlip3.ogg']), vol: 0.55 },
  book: { files: list('rpg', ['bookOpen.ogg']), vol: 0.5 },
  chest: { files: list('rpg', ['doorOpen_1.ogg', 'doorOpen_2.ogg']), vol: 0.5, rate: [1.05, 1.15] },
  latch: { files: list('rpg', ['metalLatch.ogg', 'metalClick.ogg']), vol: 0.45 },
  // house & water
  door: { files: list('rpg', ['creak1.ogg', 'creak2.ogg', 'creak3.ogg']), vol: 0.45 },
  doorShut: { files: list('rpg', ['doorClose_1.ogg', 'doorClose_2.ogg', 'doorClose_3.ogg', 'doorClose_4.ogg']), vol: 0.4 },
  bubbles: { files: list('water', ['bubble_01.ogg', 'bubble_02.ogg', 'bubble_03.ogg']), vol: 0.35 },
  // romance, plushies & ui
  kiss: { files: list('kiss', ['kiss.mp3', 'kiss-back.mp3', 'smack.mp3']), vol: 0.75, rate: [0.97, 1.04], duck: 1800 },
  hug: { files: list('ui', ['confirmation_002.ogg', 'confirmation_004.ogg']), vol: 0.4, rate: [0.9, 1], duck: 1800 },
  squeak: { files: seq('water', 'slime_', 6, 2, 1), vol: 0.4, rate: [1.15, 1.35], duck: 900 },
  squish: { files: list('ui', ['drop_004.ogg']), vol: 0.4 },
  chime: { files: seq('impact', 'impactBell_heavy_', 5), vol: 0.22, rate: [1.6, 2.0], duck: 1200 },
  bell: { files: seq('impact', 'impactBell_heavy_', 5), vol: 0.3, rate: [0.9, 1.15] },
  shimmer: { files: list('ui', ['glass_002.ogg', 'glass_004.ogg', 'glass_006.ogg']), vol: 0.35 },
  sparkle: { files: list('ui', ['glass_001.ogg', 'glass_003.ogg', 'glass_005.ogg']), vol: 0.3 },
  pop: { files: list('ui', ['drop_002.ogg', 'pluck_001.ogg']), vol: 0.4, rate: [1.1, 1.25] },
  ding: { files: list('ui', ['confirmation_001.ogg', 'confirmation_003.ogg']), vol: 0.45 },
  miss: { files: list('ui', ['back_002.ogg', 'error_004.ogg']), vol: 0.35 },
  click: { files: list('ui', ['click_002.ogg', 'click_003.ogg', 'click_004.ogg']), vol: 0.4 },
  tick: { files: list('ui', ['tick_001.ogg', 'tick_002.ogg']), vol: 0.4 },
  select: { files: list('ui', ['select_001.ogg', 'select_003.ogg', 'select_005.ogg']), vol: 0.4 },
  open: { files: list('ui', ['open_001.ogg', 'open_002.ogg', 'maximize_006.ogg']), vol: 0.38 },
  close: { files: list('ui', ['close_001.ogg', 'close_002.ogg', 'minimize_006.ogg']), vol: 0.36 },
  notify: { files: list('ui', ['maximize_008.ogg', 'confirmation_002.ogg']), vol: 0.45 },
  gift: { files: list('ui', ['maximize_003.ogg', 'maximize_009.ogg']), vol: 0.45, duck: 1200 },
  unlock: { files: list('ui', ['confirmation_004.ogg']), vol: 0.5 },
  heartbeat: { files: seq('impact', 'impactSoft_heavy_', 5), vol: 0.55, rate: [0.6, 0.7] },
  flare: { files: list('ui', ['maximize_008.ogg', 'question_001.ogg', 'question_003.ogg']), vol: 0.6 },
  rune: { files: seq('impact', 'impactBell_heavy_', 5), vol: 0.18, rate: [2.1, 2.3] },
  harp: { files: list('ui', ['pluck_002.ogg']), vol: 0.55 },
};
// short aliases used around the app
const ALIAS: Record<string, string> = { step: 'step:grass', stepWood: 'step:wood', tap: 'click' };

let ctx: AudioContext | null = null, out: GainNode | null = null, muted = false;
const buffers = new Map<string, AudioBuffer | null>(), loading = new Map<string, Promise<AudioBuffer | null>>();
const ac = () => {
  if (!ctx) { ctx = new AudioContext(); out = ctx.createGain(); out.gain.value = 0.9; out.connect(ctx.destination); }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};
function load(file: string) {
  if (buffers.has(file)) return Promise.resolve(buffers.get(file)!);
  if (!loading.has(file)) {
    loading.set(file, fetch(B + file).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
      .then((a) => ac().decodeAudioData(a)).then((b) => (buffers.set(file, b), b)).catch(() => (buffers.set(file, null), null)));
  }
  return loading.get(file)!;
}
const last = new Map<string, number>();
/** play a named sound; vol multiplies the bank volume, rate overrides the pitch */
export function playSfx(name: string, opt: { vol?: number; rate?: number; delay?: number } = {}) {
  if (muted) return;
  const bank = BANKS[ALIAS[name] ?? name]; if (!bank) return;
  try {
    const c = ac(), prev = last.get(name) ?? -1;
    let i = Math.floor(Math.random() * bank.files.length);
    if (bank.files.length > 1 && i === prev) i = (i + 1) % bank.files.length;      // never the same take twice in a row
    last.set(name, i);
    if (bank.duck) duckMusic(bank.duck);
    load(bank.files[i]).then((buf) => {
      if (!buf) return fallback(name);
      const s = c.createBufferSource(), g = c.createGain();
      s.buffer = buf;
      const [r0, r1] = bank.rate ?? [0.95, 1.05];
      s.playbackRate.value = opt.rate ?? r0 + Math.random() * (r1 - r0);
      g.gain.value = bank.vol * (opt.vol ?? 1);
      s.connect(g).connect(out!); s.start(c.currentTime + (opt.delay ?? 0));
    });
  } catch { /* audio is locked until the first tap */ }
}
/** sampled harp note (the piano and the music studio): one pluck sample re-pitched per note */
export function playNote(midi: number) { playSfx('harp', { rate: 2 ** ((midi - 72) / 12) }); }
export function setSfxMuted(m: boolean) { muted = m; }
/** decode the common sounds right after the first tap so the first footstep isn't late */
export function warmSfx() {
  try { ac(); } catch { return; }
  ['step:grass', 'step:wood', 'step:stone', 'step:sand', 'jump', 'land', 'chop', 'clink', 'collect', 'pop', 'click', 'kiss', 'hug', 'door', 'splash', 'select', 'open', 'close']
    .forEach((n) => BANKS[n].files.forEach((f) => load(f)));
}

// only used if a file can't be fetched or decoded (the sound still happens, just simpler)
function fallback(name: string) {
  try {
    const c = ac(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    const f = name.startsWith('step') ? 180 : name === 'kiss' ? 1400 : name.includes('chop') ? 150 : 660;
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.4, t + 0.1);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(name.startsWith('step') ? 0.02 : 0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(out!); o.start(t); o.stop(t + 0.2);
  } catch { /* */ }
}
export const SFX_NAMES = Object.keys(BANKS);
