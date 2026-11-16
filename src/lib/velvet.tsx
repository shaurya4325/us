import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { other, nameOf, type Who } from '../config/people';
import { moodById, type MoodId } from '../config/moodPhotos';
import { addTo, setDoc, watchCol, watchDoc, getStatus, onStatus, FB, ROOT, type Doc, type SyncStatus } from './sync';
import { buzz, notify, PATTERNS, sfx, native, nativePrefs, askNotifyPermission, type Sfx } from './fx';

export interface PersonState { since?: number; mood?: MoodId; moodAt?: number; online?: boolean; lastSeen?: number; cutout?: string; roomMode?: string; energy?: number; fcm?: string }
export interface Ev { id: string; from: Who; to: Who; type: string; text?: string; data?: Doc; at: number }
export interface Session { roomId: string; who: Who; deviceId: string }

const ONLINE_MS = 25_000;
const AWAKE = new URLSearchParams(location.search).has('awake'); // testing: two windows on one PC count as visible
const visible = () => AWAKE || !document.hidden;
export const isOnline = (p?: PersonState, now = Date.now()) => !!p?.online && now - (p.lastSeen ?? 0) < ONLINE_MS;

/** how each event announces itself on the partner's phone: [title, body, sound, priority] */
export function describe(e: Ev): [string, string, Sfx, boolean] {
  const n = nameOf(e.from), t = e.text ?? '';
  switch (e.type) {
    case 'flare': return [`🚨 ${n} needs you`, 'Emergency Comfort Flare — hold them close right now.', 'flare', true];
    case 'bothered': return [`💗 ${n}: something is bothering me…`, `${t}${e.data?.tone ? ` · (${e.data.tone})` : ''}`, 'chime', true];
    case 'tell': return [`💌 ${n} wants to tell you something`, e.data?.voice ? '🎙️ Voice note' : t, 'chime', false];
    case 'mood': { const m = moodById(t); return [`${m.emoji} ${n} is feeling ${m.label}`, m.priority ? 'Priority care: check on them gently.' : 'Their photo just changed on your mood bar.', m.priority ? 'chime' : 'shimmer', !!m.priority]; }
    case 'squeeze': return [`🧸 ${n} is squeezing ${t}`, 'wants real cuddles', 'squeak', false];
    case 'poke': return [`👉 ${n} poked you`, 'thinking of you', 'pop', false];
    case 'need': return [`🫶 What ${n} needs right now`, t, 'chime', false];
    case 'coupon': return [`🎟️ ${n} prescribed you a coupon`, t, 'shimmer', false];
    case 'redeem': return [`🎟️ ${n} redeemed a coupon`, t, 'shimmer', false];
    case 'rx': return [`🩺 Prescription from Dr. ${n}`, t, 'chime', false];
    case 'zipper': return [`🤐 ${n} hid something inside ${t}`, 'Unzip the heart to find it.', 'shimmer', false];
    case 'checkup': return [`📋 ${n} did their checkup`, t, 'pop', false];
    case 'tease': return [`😈 ${n} is teasing you`, t, 'pop', false];
    case 'room': return [`🏠 ${n}: ${t}`, 'The cozy room lights changed.', 'pop', false];
    case 'sunday': return [`🕯️ ${n} answered Sunday Safe Space`, 'Your turn — answers reveal when you both submit.', 'chime', false];
    case 'game': return [`🎮 ${n} started a game`, t, 'pop', false];
    case 'reply': return [`💬 ${n}`, t, 'chime', false];
    case 'summon': return [`💗 ${n} is waiting at the gate of us!!`, 'Tap to enter our world together', 'flare', true];
    case 'update': return [`✨ ${n} pushed a new update to us!!`, t, 'shimmer', true];
    case 'build': return [`🏡 ${n} built something`, t, 'shimmer', false];
    case 'adopt': return [`🐾 ${n} adopted a pet`, t, 'shimmer', false];
    case 'cook': return [`🍳 ${n} cooked for you`, t, 'chime', false];
    case 'world': return [`🌿 ${n}`, t, 'pop', false];
    default: return [`💗 ${n}`, t, 'pop', false];
  }
}

interface Ctx {
  s: Session; me: Who; partner: Who; base: string; status: SyncStatus;
  states: Record<Who, PersonState>; events: Ev[];
  send: (type: string, text?: string, data?: Doc) => Promise<void>;
  setMe: (p: Partial<PersonState>) => void;
  toast: (title: string, body?: string) => void; toasts: { id: number; title: string; body?: string }[];
  tease: { kind: string; until: number } | null; clearTease: () => void;
  ripple: number;
}
const C = createContext<Ctx>(null as any);
export const useVelvet = () => useContext(C);

/** live shared doc under the room, e.g. useShared('game') */
export function useShared<T extends Doc>(key: string): [T | null, (d: Partial<T> | Doc, merge?: boolean) => void] {
  const { base } = useVelvet();
  const [d, setD] = useState<T | null>(null);
  useEffect(() => watchDoc(`${base}/shared/${key}`, (x) => setD(x as T)), [base, key]);
  return [d, useCallback((v: Doc, merge = true) => void setDoc(`${base}/shared/${key}`, v, merge), [base, key])];
}

export function VelvetProvider({ s, children }: { s: Session; children: ReactNode }) {
  const me = s.who, partner = other(me), base = `${ROOT}/${s.roomId}`;
  const [states, setStates] = useState<Record<Who, PersonState>>({ shaurya: {}, arushi: {} });
  const [events, setEvents] = useState<Ev[]>([]);
  const [status, setStatus] = useState(getStatus());
  const [toasts, setToasts] = useState<Ctx['toasts']>([]);
  const [tease, setTease] = useState<Ctx['tease']>(null);
  const [ripple, setRipple] = useState(0);
  const clearTease = useCallback(() => setTease(null), []);
  const seenKey = `vu:seen:${s.roomId}:${me}`;
  const seen = useRef<number>(Number(localStorage.getItem(seenKey) || Date.now() - 6 * 3600e3));

  const toast = useCallback((title: string, body?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4800);
  }, []);

  useEffect(() => onStatus(setStatus), []);
  useEffect(() => {
    const u1 = watchDoc(`${base}/state/shaurya`, (d) => setStates((p) => ({ ...p, shaurya: d ?? {} })));
    const u2 = watchDoc(`${base}/state/arushi`, (d) => setStates((p) => ({ ...p, arushi: d ?? {} })));
    const u3 = watchCol(`${base}/events`, 80, (rows) => setEvents(rows as Ev[]));
    return () => { u1(); u2(); u3(); };
  }, [base]);

  // incoming events addressed to me → sound, haptic pattern, toast, native notification, live effects
  useEffect(() => {
    const fresh = events.filter((e) => e.to === me && e.from !== me && e.at > seen.current).reverse();
    if (!fresh.length) return;
    seen.current = Math.max(...fresh.map((e) => e.at));
    localStorage.setItem(seenKey, String(seen.current));
    for (const e of fresh) {
      const [title, body, sound] = describe(e);
      const live = Date.now() - e.at < 20_000;
      toast(title, body);
      if (!live) continue;
      sfx(sound); buzz(PATTERNS[e.type] ?? PATTERNS.default);
      if (!visible() || native) notify(title, body);
      if (e.type === 'tease') setTease({ kind: e.data?.kind ?? 'kisses', until: Date.now() + 8000 });
      if (e.type === 'poke' || e.type === 'squeeze') setRipple((r) => r + 1);
    }
  }, [events, me, seenKey, toast]);

  const setMe = useCallback((p: Partial<PersonState>) => void setDoc(`${base}/state/${me}`, p), [base, me]);
  const send = useCallback(async (type: string, text = '', data: Doc = {}) => {
    await addTo(`${base}/events`, { from: me, to: partner, type, text, data, at: Date.now() });
  }, [base, me, partner]);

  // presence heartbeat (Firestore-friendly version of .info/connected + onDisconnect)
  useEffect(() => {
    let since = Date.now(), was = visible();
    const beat = () => { const on = visible(); if (on && !was) since = Date.now(); was = on; setMe({ online: on, lastSeen: Date.now(), since }); };
    beat();
    const t = setInterval(beat, 8_000);
    const vis = () => beat();
    const bye = () => setMe({ online: false, lastSeen: Date.now() });
    document.addEventListener('visibilitychange', vis); window.addEventListener('pagehide', bye);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', bye); bye(); };
  }, [setMe]);

  // notifications: permission, background poller config, optional FCM token
  useEffect(() => {
    askNotifyPermission();
    if (native && FB) nativePrefs({ projectId: FB.projectId, apiKey: FB.apiKey, roomId: s.roomId, who: me });
    if (native && import.meta.env.VITE_FCM === '1') {
      PushNotifications.requestPermissions().then((r) => { if (r.receive === 'granted') PushNotifications.register(); });
      PushNotifications.addListener('registration', (t) => setMe({ fcm: t.value }));
    }
  }, [s.roomId, me, setMe]);

  const value = useMemo<Ctx>(() => ({
    s, me, partner, base, status, states, events, send, setMe, toast, toasts, tease, clearTease, ripple,
  }), [s, me, partner, base, status, states, events, send, setMe, toast, toasts, tease, ripple]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
