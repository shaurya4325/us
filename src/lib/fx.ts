// Sound (Web Audio synth), haptics (Capacitor or navigator.vibrate) and notifications.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';

export const native = Capacitor.isNativePlatform();
let ctx: AudioContext | null = null;
let muted = (() => { try { return localStorage.getItem('vu:mute') === '1'; } catch { return false; } })();
export const isMuted = () => muted;
export const setMuted = (m: boolean) => { muted = m; try { localStorage.setItem('vu:mute', m ? '1' : '0'); } catch { /* */ } };

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.12, delay = 0, slide = 0) {
  if (muted) return;
  ctx ??= new AudioContext();
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}

export type Sfx = 'pop' | 'squeak' | 'shimmer' | 'heartbeat' | 'chime' | 'flare' | 'tap';
export function sfx(s: Sfx) {
  try {
    if (s === 'pop') tone(520, 0.09, 'sine', 0.14, 0, 1.8);
    if (s === 'tap') tone(880, 0.05, 'triangle', 0.06);
    if (s === 'squeak') { tone(900, 0.12, 'sine', 0.1, 0, 1.6); tone(1300, 0.1, 'sine', 0.08, 0.1, 0.7); }
    if (s === 'shimmer') [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.35, 'sine', 0.05, i * 0.06));
    if (s === 'heartbeat') { tone(70, 0.14, 'sine', 0.3); tone(62, 0.16, 'sine', 0.24, 0.2); }
    if (s === 'chime') [784, 1175].forEach((f, i) => tone(f, 0.6, 'sine', 0.08, i * 0.14));
    if (s === 'flare') [659, 880, 659, 880].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.18));
  } catch { /* audio blocked until first gesture */ }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** pattern: alternating vibrate/pause ms */
export async function buzz(pattern: number[] | 'light' | 'medium' | 'heavy' = 'light') {
  try {
    if (typeof pattern === 'string') {
      if (native) return Haptics.impact({ style: { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }[pattern] });
      return navigator.vibrate?.({ light: 10, medium: 25, heavy: 50 }[pattern]);
    }
    if (!native) return navigator.vibrate?.(pattern);
    for (let i = 0; i < pattern.length; i++) i % 2 ? await wait(pattern[i]) : (await Haptics.vibrate({ duration: pattern[i] }), await wait(pattern[i]));
  } catch { /* no haptics */ }
}

export const PATTERNS: Record<string, number[]> = {
  flare: [120, 80, 120, 400, 120, 80, 120], bothered: [60, 60, 200], tell: [40, 80, 40], squeeze: [30, 40, 30, 40, 90],
  poke: [25, 60, 25], mood: [35], heartbeat: [70, 140, 90], default: [40],
};

let nid = 1;
export async function notify(title: string, body: string) {
  try {
    if (native) {
      await LocalNotifications.schedule({ notifications: [{ id: nid++, title, body, smallIcon: 'ic_stat_heart', iconColor: '#FF3E8A' }] });
    } else if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(title, { body });
    }
  } catch (e) { console.warn('[notify]', e); }
}
export async function askNotifyPermission() {
  try {
    if (native) await LocalNotifications.requestPermissions();
    else if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
  } catch { /* ignore */ }
}

/** values the native background poller (VelvetPoller.java) reads from Capacitor's SharedPreferences */
export const nativePrefs = (v: object) => Preferences.set({ key: 'us_native', value: JSON.stringify(v) }).catch(() => {});
