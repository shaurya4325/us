// Foley SFX synthesised with Web Audio (zero download, zero latency) + the bundled ambient soundtrack.
import { isMuted } from '../lib/fx';

let ctx: AudioContext | null = null, noise: AudioBuffer | null = null, master: GainNode | null = null;
const ac = () => {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

function tone(f: number, dur: number, type: OscillatorType = 'sine', vol = 0.1, delay = 0, slide = 1) {
  const c = ac(), t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!); o.start(t); o.stop(t + dur + 0.05);
}
function hiss(dur: number, freq: number, q = 1, vol = 0.2, delay = 0, type: BiquadFilterType = 'bandpass', sweep = 1) {
  const c = ac(), t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise; f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep !== 1) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur); f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master!); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

export function sound(name: string) {
  if (isMuted()) return;
  try {
    switch (name) {
      case 'step': hiss(0.07, 900 + Math.random() * 400, 0.8, 0.05); break;                       // soft grass
      case 'stepWood': tone(180 + Math.random() * 30, 0.06, 'triangle', 0.05); hiss(0.04, 2200, 1, 0.03); break;
      case 'swim': hiss(0.25, 700, 0.6, 0.06, 0, 'lowpass', 0.5); break;
      case 'jump': tone(420, 0.15, 'sine', 0.07, 0, 1.8); break;
      case 'land': hiss(0.08, 400, 0.7, 0.08); break;
      case 'swoosh': hiss(0.16, 600, 1.2, 0.08, 0, 'bandpass', 3); break;
      case 'chop': tone(150, 0.1, 'square', 0.06, 0, 0.6); hiss(0.09, 1400, 2, 0.16); break;
      case 'clink': tone(1800, 0.18, 'triangle', 0.07); tone(2600, 0.14, 'sine', 0.05, 0.01); hiss(0.05, 4000, 3, 0.08); break;
      case 'crystal': [1568, 2093, 2637].forEach((f, i) => tone(f, 0.5, 'sine', 0.05, i * 0.05)); break;
      case 'pick': tone(880, 0.08, 'sine', 0.06, 0, 1.4); hiss(0.06, 3000, 1, 0.04); break;
      case 'collect': [988, 1319].forEach((f, i) => tone(f, 0.18, 'sine', 0.06, i * 0.07)); break;
      case 'catch': tone(660, 0.12, 'triangle', 0.06, 0, 1.5); tone(1320, 0.2, 'sine', 0.05, 0.1); break;
      case 'cast': hiss(0.3, 900, 1, 0.08, 0, 'bandpass', 3); break;
      case 'splash': hiss(0.4, 1200, 0.5, 0.12, 0, 'lowpass', 0.4); tone(300, 0.12, 'sine', 0.04, 0, 0.5); break;
      case 'sizzle': hiss(1.2, 5000, 0.4, 0.06, 0, 'highpass'); break;
      case 'build': [392, 523, 659, 784].forEach((f, i) => tone(f, 0.25, 'triangle', 0.06, i * 0.08)); hiss(0.2, 800, 1, 0.08); break;
      case 'door': tone(220, 0.35, 'sine', 0.06, 0, 0.7); hiss(0.3, 500, 1, 0.05); break;
      case 'squeak': tone(900, 0.12, 'sine', 0.08, 0, 1.6); tone(1300, 0.1, 'sine', 0.06, 0.1, 0.7); break;
      case 'kiss': hiss(0.06, 3000, 4, 0.12); tone(1400, 0.08, 'sine', 0.05, 0.02, 1.5); [1047, 1568].forEach((f, i) => tone(f, 0.5, 'sine', 0.04, 0.12 + i * 0.1)); break;
      case 'hug': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.7, 'sine', 0.04, i * 0.09)); break;
      case 'heartbeat': tone(70, 0.14, 'sine', 0.25); tone(62, 0.16, 'sine', 0.2, 0.2); break;
      case 'shimmer': [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.35, 'sine', 0.04, i * 0.06)); break;
      case 'pop': tone(520, 0.09, 'sine', 0.1, 0, 1.8); break;
      case 'ding': tone(1568, 0.4, 'sine', 0.08); break;
      case 'miss': tone(300, 0.25, 'triangle', 0.06, 0, 0.6); break;
    }
  } catch { /* audio locked until first tap */ }
}
export function note(midi: number, dur = 0.9) { if (!isMuted()) try { const f = 440 * 2 ** ((midi - 69) / 12); tone(f, dur, 'triangle', 0.07); tone(f * 2, dur * 0.6, 'sine', 0.025); } catch { /* */ } }

/* ---------- ambient soundtrack (bundled mp3, crossfaded) ---------- */
export const TRACKS = { meadow: 'meadow-breeze', sunset: 'sunset-clouds', rain: 'fireplace-rain', stars: 'stargazing-lullaby' } as const;
export type Track = keyof typeof TRACKS;
let el: HTMLAudioElement | null = null, curTrack: Track | null = null;
export function music(t: Track | null) {
  if (t === curTrack && el && !el.paused) return;
  curTrack = t;
  const old = el;
  if (old) { const o = old; let v = o.volume; const iv = setInterval(() => { v -= 0.05; if (v <= 0) { clearInterval(iv); o.pause(); } else o.volume = v; }, 60); }
  el = null;
  if (!t || isMuted()) return;
  const a = new Audio(`${import.meta.env.BASE_URL}audio/${TRACKS[t]}.mp3`);
  a.loop = true; a.volume = 0; el = a;
  a.play().then(() => { let v = 0; const iv = setInterval(() => { v += 0.03; if (v >= 0.45 || el !== a) { clearInterval(iv); } else a.volume = v; }, 80); }).catch(() => { /* waits for a tap */ });
}
export const currentTrack = () => curTrack;
export function unlockAudio() { try { ac(); if (el?.paused && !isMuted()) el.play().catch(() => {}); } catch { /* */ } }
