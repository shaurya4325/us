// UI sounds (real samples via the SoundEffectsManager), haptics (Capacitor or navigator.vibrate) and notifications.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { playSfx } from '../audio/SoundEffectsManager';

export const native = Capacitor.isNativePlatform();
const ls = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
let muted = ls('vu:mute', '0') === '1';
let music = Number(ls('vu:music', '0.8'));
export const isMuted = () => muted;
export const setMuted = (m: boolean) => { muted = m; try { localStorage.setItem('vu:mute', m ? '1' : '0'); } catch { /* */ } };
/** soundtrack level 0..1 (0 = off) */
export const musicLevel = () => (Number.isFinite(music) ? music : 0.8);
export const setMusicLevel = (v: number) => { music = v; try { localStorage.setItem('vu:music', String(v)); } catch { /* */ } };

export type Sfx = 'pop' | 'squeak' | 'shimmer' | 'heartbeat' | 'chime' | 'flare' | 'tap';
const SFX_MAP: Record<Sfx, string> = { pop: 'pop', tap: 'click', squeak: 'squeak', shimmer: 'shimmer', heartbeat: 'heartbeat', chime: 'notify', flare: 'flare' };
export function sfx(s: Sfx) { if (!muted) playSfx(SFX_MAP[s]); }

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
