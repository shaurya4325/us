// One tiny data layer for the app + admin: Firestore when .env has keys, otherwise localStorage + BroadcastChannel
// (so two browser tabs act as two phones in demo mode).
import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, increment, collection, onSnapshot, setDoc as fsSet, addDoc, getDoc as fsGet, query, orderBy, limit as fsLimit, deleteDoc,
} from 'firebase/firestore';

export type Doc = Record<string, any>;
type Unsub = () => void;
export type SyncStatus = 'live' | 'demo' | 'denied';

const env = import.meta.env;
export const FB = env.VITE_FB_API_KEY
  ? { apiKey: env.VITE_FB_API_KEY, authDomain: env.VITE_FB_AUTH_DOMAIN, projectId: env.VITE_FB_PROJECT_ID, appId: env.VITE_FB_APP_ID }
  : null;

let status: SyncStatus = FB ? 'live' : 'demo';
const statusSubs = new Set<(s: SyncStatus) => void>();
export const getStatus = () => status;
export const onStatus = (cb: (s: SyncStatus) => void) => (statusSubs.add(cb), () => void statusSubs.delete(cb));
const fail = (e: any) => {
  console.warn('[sync]', e?.code || e);
  if (String(e?.code).includes('permission')) { status = 'denied'; statusSubs.forEach((f) => f(status)); }
};

export const ROOT = 'us';
export async function roomIdFor(code: string) {
  const norm = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('us!!:' + norm));
  return Array.from(new Uint8Array(buf)).slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ---------------- Firestore backend ---------------- */
const db = FB ? getFirestore(initializeApp(FB)) : null;

/* ---------------- local demo backend ---------------- */
const subs = new Map<string, Set<() => void>>();
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('us-app') : null;
const ping = (key: string, fromRemote = false) => {
  subs.get(key)?.forEach((f) => f());
  if (!fromRemote) bc?.postMessage(key);
};
bc && (bc.onmessage = (e) => ping(e.data, true));
const lsGet = (k: string, d: any) => { try { return JSON.parse(localStorage.getItem('us:' + k) ?? 'null') ?? d; } catch { return d; } };
const lsSet = (k: string, v: any) => { try { localStorage.setItem('us:' + k, JSON.stringify(v)); } catch (e) { console.warn(e); } ping(k); };
const sub = (k: string, f: () => void): Unsub => {
  if (!subs.has(k)) subs.set(k, new Set());
  subs.get(k)!.add(f); f();
  return () => void subs.get(k)!.delete(f);
};
const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
export function deepMerge(a: Doc, b: Doc): Doc {
  const out: Doc = { ...a };
  for (const k in b) out[k] = isObj(b[k]) && isObj(a?.[k]) ? deepMerge(a[k], b[k]) : b[k];
  return out;
}

/* ---------------- public API ---------------- */
export function watchDoc(path: string, cb: (d: Doc | null) => void): Unsub {
  if (db) return onSnapshot(doc(db, path), (s) => cb(s.exists() ? s.data() : null), fail);
  return sub('d:' + path, () => cb(lsGet('d:' + path, null)));
}
export async function getDoc(path: string): Promise<Doc | null> {
  if (db) { const s = await fsGet(doc(db, path)); return s.exists() ? s.data() : null; }
  return lsGet('d:' + path, null);
}
export async function setDoc(path: string, data: Doc, merge = true) {
  if (db) return fsSet(doc(db, path), data, { merge }).catch(fail);
  lsSet('d:' + path, merge ? deepMerge(lsGet('d:' + path, {}), data) : data);
}
export async function removeDoc(path: string) {
  if (db) return deleteDoc(doc(db, path)).catch(fail);
  try { localStorage.removeItem('us:d:' + path); } catch { /* ignore */ }
  ping('d:' + path);
}
export async function addTo(col: string, data: Doc): Promise<string> {
  if (db) return addDoc(collection(db, col), data).then((r) => r.id).catch((e) => (fail(e), ''));
  const id = Math.random().toString(36).slice(2, 12);
  lsSet('c:' + col, [{ id, ...data }, ...lsGet('c:' + col, [])].slice(0, 400));
  return id;
}
/** newest first */
export function watchCol(col: string, n: number, cb: (rows: Doc[]) => void): Unsub {
  if (db) return onSnapshot(query(collection(db, col), orderBy('at', 'desc'), fsLimit(n)), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), fail);
  return sub('c:' + col, () => cb(lsGet('c:' + col, []).slice(0, n)));
}

/** dotted-key patch with numeric increments, e.g. patch(p, { 'nodes.t3': 123 }, { 'inv.wood': 2 }) — safe when both phones write at once */
export async function patch(path: string, fields: Doc = {}, incs: Record<string, number> = {}) {
  const nest = (o: Doc, k: string, v: any) => { const ks = k.split('.'); let c = o; ks.slice(0, -1).forEach((x) => (c = c[x] ??= {})); c[ks[ks.length - 1]] = v; };
  const out: Doc = {};
  for (const k in fields) nest(out, k, fields[k]);
  if (db) {
    for (const k in incs) nest(out, k, increment(incs[k]));
    return fsSet(doc(db, path), out, { merge: true }).catch(fail);
  }
  const cur = lsGet('d:' + path, {});
  for (const k in incs) nest(out, k, (k.split('.').reduce((c: any, x) => c?.[x], cur) ?? 0) + incs[k]);
  lsSet('d:' + path, deepMerge(cur, out));
}
