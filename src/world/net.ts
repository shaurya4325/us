// Live co-op link: a direct WebRTC data channel between the two phones (10 Hz, no server),
// signalled through the room's Firestore doc. Falls back to a throttled Firestore doc if P2P can't connect.
import { setDoc, watchDoc } from '../lib/sync';
import type { Who } from '../config/people';

export interface Snap { p: [number, number, number]; r: number; a: string; tl: string; ti?: number; b?: number; s: 'over' | 'inside'; v: number; t: number }
export interface Act { k: string; t: number; d?: any }
type Msg = { snap?: Snap; act?: Act };

const ICE: RTCConfiguration = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };

export class Net {
  onSnap: (s: Snap) => void = () => {};
  onAct: (a: Act) => void = () => {};
  mode: 'p2p' | 'cloud' = 'cloud';
  private pc: RTCPeerConnection | null = null; private ch: RTCDataChannel | null = null;
  private sid = ''; private unsubs: (() => void)[] = []; private lastCloud = 0; private lastSent = '';
  private retry: any = null; private dead = false; private seenActs = new Set<string>();

  constructor(private base: string, private me: Who) {
    const partner = me === 'shaurya' ? 'arushi' : 'shaurya';
    // cloud fallback channel (also carries actions so nothing is lost)
    this.unsubs.push(watchDoc(`${base}/live/${partner}`, (d) => {
      if (!d) return;
      if (this.mode === 'cloud' && d.snap && Date.now() - d.snap.t < 15_000) this.onSnap(d.snap);
      if (d.act && Date.now() - d.act.t < 8000) this.gotAct(d.act);
    }));
    this.unsubs.push(watchDoc(`${base}/rtc/session`, (d) => this.signal(d)));
    if (me === 'shaurya') this.offer();
  }

  private gotAct(a: Act) { const key = a.k + a.t; if (this.seenActs.has(key)) return; this.seenActs.add(key); this.onAct(a); }

  private wire(ch: RTCDataChannel) {
    this.ch = ch;
    ch.onopen = () => { this.mode = 'p2p'; console.info('[net] p2p open'); };
    ch.onclose = () => { this.mode = 'cloud'; if (this.me === 'shaurya' && !this.dead) this.offerSoon(); };
    ch.onmessage = (e) => { try { const m: Msg = JSON.parse(e.data); if (m.snap) this.onSnap(m.snap); if (m.act) this.gotAct(m.act); } catch { /* */ } };
  }

  private gather(pc: RTCPeerConnection) {
    return new Promise<void>((ok) => {
      if (pc.iceGatheringState === 'complete') return ok();
      const t = setTimeout(ok, 2500);
      pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); ok(); } });
    });
  }

  private async offer() {
    if (this.dead) return;
    try {
      this.pc?.close();
      const pc = (this.pc = new RTCPeerConnection(ICE));
      this.wire(pc.createDataChannel('us', { ordered: false, maxRetransmits: 0 }));
      pc.onconnectionstatechange = () => { if (['failed', 'disconnected'].includes(pc.connectionState)) { this.mode = 'cloud'; this.offerSoon(); } };
      await pc.setLocalDescription(await pc.createOffer());
      await this.gather(pc);
      this.sid = Math.random().toString(36).slice(2, 10);
      await setDoc(`${this.base}/rtc/session`, { sid: this.sid, offer: pc.localDescription?.sdp ?? '', answer: '', at: Date.now() }, false);
      this.offerSoon(25_000);
    } catch (e) { console.warn('[net] offer', e); this.offerSoon(); }
  }
  private offerSoon(ms = 6000) { clearTimeout(this.retry); this.retry = setTimeout(() => { if (this.mode !== 'p2p') this.offer(); }, ms); }

  private async signal(d: any) {
    if (!d || this.dead) return;
    try {
      if (this.me === 'shaurya') {
        if (d.sid === this.sid && d.answer && this.pc && this.pc.signalingState === 'have-local-offer') await this.pc.setRemoteDescription({ type: 'answer', sdp: d.answer });
        return;
      }
      if (!d.offer || d.answer || d.sid === this.sid || Date.now() - d.at > 60_000) return;
      this.sid = d.sid;
      this.pc?.close();
      const pc = (this.pc = new RTCPeerConnection(ICE));
      pc.ondatachannel = (e) => this.wire(e.channel);
      await pc.setRemoteDescription({ type: 'offer', sdp: d.offer });
      await pc.setLocalDescription(await pc.createAnswer());
      await this.gather(pc);
      await setDoc(`${this.base}/rtc/session`, { answer: pc.localDescription?.sdp ?? '' });
    } catch (e) { console.warn('[net] signal', e); }
  }

  /** my state; p2p every call (~10 Hz), cloud only when changed and at most 2.5 Hz */
  send(s: Snap) {
    if (this.mode === 'p2p' && this.ch?.readyState === 'open') { this.ch.send(JSON.stringify({ snap: s })); return; }
    const key = `${s.p.map((x) => x.toFixed(1)).join()}|${s.a}|${s.tl}|${s.s}|${Math.round(s.r * 4)}`;
    if (key === this.lastSent || Date.now() - this.lastCloud < 400) return;
    this.lastSent = key; this.lastCloud = Date.now();
    setDoc(`${this.base}/live/${this.me}`, { snap: s });
  }
  act(a: Act) {
    if (this.ch?.readyState === 'open') this.ch.send(JSON.stringify({ act: a }));
    setDoc(`${this.base}/live/${this.me}`, { act: a });
  }
  close() { this.dead = true; clearTimeout(this.retry); this.unsubs.forEach((u) => u()); this.ch?.close(); this.pc?.close(); }
}
