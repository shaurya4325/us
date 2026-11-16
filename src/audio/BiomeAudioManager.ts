// Soundtrack engine: one bundled Kevin MacLeod track per zone (5 biomes + the house + late night), switched with a
// 2.5 s equal-power crossfade. Kisses, hugs, plushie squeezes and voice notes duck the music to 25% and then let it
// swell back. If a track can't play, a gentle Web Audio Lydian "sky harp" pad takes its place so music never breaks.
import type { Zone } from '../data/biomes';

export const ZONE_TRACKS: Record<Zone, { file: string; title: string }> = {
  prairie: { file: 'prairie', title: 'Almost Bliss' },
  sakura: { file: 'sakura', title: 'Ishikari Lore' },
  azure: { file: 'azure', title: 'Floating Cities' },
  cliffs: { file: 'starlight', title: 'Dream Culture' },
  lagoon: { file: 'lagoon', title: 'Clean Soul' },
  home: { file: 'home', title: 'Calmant' },
  night: { file: 'night', title: 'Healing' },
};
export const MUSIC_CREDIT = 'Music: Kevin MacLeod — incompetech.com (CC BY 4.0) · Sound effects: Kenney & OpenGameArt (CC0)';

const FADE = 2500, BASE = 0.42;
interface Voice { zone: Zone; el: HTMLAudioElement | null; pad: Pad | null; gain: number; target: number; from: number; t0: number }
let voices: Voice[] = [], current: Zone | null = null, muted = false, volume = 1, raf = 0, duckUntil = 0, duckK = 1;
let ctx: AudioContext | null = null;

function tick() {
  raf = 0;
  const now = performance.now();
  duckK += ((now < duckUntil ? 0.25 : 1) - duckK) * (now < duckUntil ? 0.35 : 0.06);
  let busy = Math.abs(duckK - (now < duckUntil ? 0.25 : 1)) > 0.01;
  voices = voices.filter((v) => {
    const k = Math.min(1, (now - v.t0) / FADE);
    // equal-power curve: fading in follows sin, fading out follows cos
    const p = v.target > v.from ? Math.sin((k * Math.PI) / 2) : 1 - Math.cos((k * Math.PI) / 2);
    v.gain = v.from + (v.target - v.from) * p;
    if (k < 1) busy = true;
    const g = muted ? 0 : v.gain * BASE * volume * duckK;
    if (v.el) v.el.volume = Math.max(0, Math.min(1, g));
    v.pad?.level(g);
    if (k >= 1 && v.target === 0) { v.el?.pause(); if (v.el) v.el.src = ''; v.pad?.stop(); return false; }
    return true;
  });
  if (busy) raf = requestAnimationFrame(tick);
}
const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

/** crossfade to the zone's track (no-op if it is already playing) */
export function setZone(z: Zone | null) {
  if (z === current) return;
  current = z;
  const now = performance.now();
  for (const v of voices) if (v.target > 0) { v.from = v.gain; v.target = 0; v.t0 = now; }
  if (!z) return kick();
  const v: Voice = { zone: z, el: null, pad: null, gain: 0, target: 1, from: 0, t0: now };
  const el = new Audio(`${import.meta.env.BASE_URL}audio/bgm/${ZONE_TRACKS[z].file}.mp3`);
  el.loop = true; el.volume = 0; el.preload = 'auto';
  el.addEventListener('error', () => { if (v.el === el) { v.el = null; v.pad = makePad(z); } });
  v.el = el; voices.push(v);
  if (!muted) el.play().catch(() => { /* waits for the first tap (unlockMusic) */ });
  kick();
}
export const currentZone = () => current;
/** duck the soundtrack to 25% for ms (hugs, kisses, plushies, voice notes) */
export function duckMusic(ms: number) { duckUntil = Math.max(duckUntil, performance.now() + ms); kick(); }
/** hold the duck while something (a voice note) is playing */
export function holdDuck(on: boolean) { duckUntil = on ? performance.now() + 36e5 : performance.now(); kick(); }
export function setMusicMuted(m: boolean) {
  muted = m;
  for (const v of voices) { if (m) v.el?.pause(); else if (v.target > 0) v.el?.play().catch(() => {}); }
  kick();
}
export function setMusicVolume(x: number) { volume = Math.max(0, Math.min(1, x)); kick(); }
export const musicVolume = () => volume;
export function unlockMusic() { if (muted) return; for (const v of voices) if (v.target > 0 && v.el?.paused) v.el.play().catch(() => {}); }

/* ---------- procedural fallback: a soft Lydian harp + pad ---------- */
interface Pad { level: (g: number) => void; stop: () => void }
function makePad(z: Zone): Pad | null {
  try {
    ctx ??= new AudioContext();
    const c = ctx, out = c.createGain(); out.gain.value = 0; out.connect(c.destination);
    const root = { prairie: 60, sakura: 62, azure: 57, cliffs: 64, lagoon: 59, home: 55, night: 53 }[z];
    const lydian = [0, 2, 4, 6, 7, 9, 11, 12, 14, 16];
    const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
    const drones = [0, 7, 16].map((iv) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = hz(root - 12 + iv); const g = c.createGain(); g.gain.value = 0.05; o.connect(g).connect(out); o.start(); return o; });
    let alive = true;
    const pluck = () => {
      if (!alive) return;
      const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.value = hz(root + lydian[Math.floor(Math.random() * lydian.length)]);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      o.connect(g).connect(out); o.start(t); o.stop(t + 2.7);
      setTimeout(pluck, 600 + Math.random() * 1400);
    };
    pluck();
    return { level: (g) => { out.gain.value = g; }, stop: () => { alive = false; drones.forEach((o) => o.stop()); out.disconnect(); } };
  } catch { return null; }
}
