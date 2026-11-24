// In-game voice chat: a direct WebRTC audio link between the two phones (signalled through the room's Firestore doc,
// like the movement link). Two modes:
//   • push-to-talk: the mic only transmits while the talk button is held
//   • always-on:    the mic stays open (with a mute toggle); echo cancellation + noise suppression are on
// If the phones can't reach each other directly, push-to-talk still works as short walkie-talkie clips sent through
// Firebase (they play automatically on the other phone).
import { setDoc, watchDoc } from './sync';
import type { Who } from '../config/people';

export type VoiceMode = 'off' | 'ptt' | 'open';
export type LinkState = 'idle' | 'connecting' | 'live' | 'failed';
export interface VoiceState { link: LinkState; mic: 'none' | 'ready' | 'blocked'; meTalking: boolean; themTalking: boolean }

const ICE: RTCConfiguration = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }] };
const MIC: MediaStreamConstraints = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } as MediaTrackConstraints };

export class VoiceLink {
  onState: (s: VoiceState) => void = () => {};
  state: VoiceState = { link: 'idle', mic: 'none', meTalking: false, themTalking: false };
  private pc: RTCPeerConnection | null = null; private sid = ''; private unsub: () => void; private retry: any = null; private dead = false;
  private stream: MediaStream | null = null; private track: MediaStreamTrack | null = null;
  private remote = new Audio(); private ac: AudioContext | null = null; private meter: any = null;
  private localAn: AnalyserNode | null = null; private remoteAn: AnalyserNode | null = null;
  private mode: VoiceMode = 'off'; private pressing = false; private muted = false;
  private rec: MediaRecorder | null = null; private chunks: Blob[] = [];

  constructor(private path: string, private me: Who) {
    this.remote.autoplay = true; (this.remote as any).playsInline = true;
    this.unsub = watchDoc(path, (d) => this.signal(d));
    if (me === 'shaurya') this.offer();
    this.meter = setInterval(() => this.measure(), 120);
  }

  /* ---------- connection (Shaurya offers, Arushi answers; one sendrecv audio transceiver, tracks swapped in later) ---------- */
  private set(p: Partial<VoiceState>) { const n = { ...this.state, ...p }; if (JSON.stringify(n) !== JSON.stringify(this.state)) { this.state = n; this.onState(n); } }
  private fresh() {
    this.pc?.close();
    const pc = (this.pc = new RTCPeerConnection(ICE));
    pc.ontrack = (e) => { const s = e.streams[0] ?? new MediaStream([e.track]); this.remote.srcObject = s; this.remote.play().catch(() => {}); this.hookRemote(s); };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') this.set({ link: 'live' });
      else if (st === 'failed' || st === 'disconnected') { this.set({ link: 'failed' }); if (this.me === 'shaurya') this.offerSoon(); }
    };
    return pc;
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
      const pc = this.fresh(); this.set({ link: 'connecting' });
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      await this.attach();
      await pc.setLocalDescription(await pc.createOffer());
      await this.gather(pc);
      this.sid = Math.random().toString(36).slice(2, 10);
      await setDoc(this.path, { sid: this.sid, offer: pc.localDescription?.sdp ?? '', answer: '', at: Date.now() }, false);
      this.offerSoon(25_000);
    } catch (e) { console.warn('[voice] offer', e); this.offerSoon(); }
  }
  private offerSoon(ms = 6000) { clearTimeout(this.retry); this.retry = setTimeout(() => { if (this.state.link !== 'live') this.offer(); }, ms); }
  private async signal(d: any) {
    if (!d || this.dead) return;
    try {
      if (this.me === 'shaurya') {
        if (d.sid === this.sid && d.answer && this.pc?.signalingState === 'have-local-offer') await this.pc.setRemoteDescription({ type: 'answer', sdp: d.answer });
        return;
      }
      if (!d.offer || d.answer || d.sid === this.sid || Date.now() - d.at > 60_000) return;
      this.sid = d.sid;
      const pc = this.fresh(); this.set({ link: 'connecting' });
      await pc.setRemoteDescription({ type: 'offer', sdp: d.offer });
      pc.getTransceivers().forEach((t) => (t.direction = 'sendrecv'));
      await this.attach();
      await pc.setLocalDescription(await pc.createAnswer());
      await this.gather(pc);
      await setDoc(this.path, { answer: pc.localDescription?.sdp ?? '' });
    } catch (e) { console.warn('[voice] signal', e); }
  }
  /** put the current mic track (or nothing) on the audio sender — no renegotiation needed */
  private async attach() {
    const tr = this.pc?.getTransceivers()[0];
    if (tr) await tr.sender.replaceTrack(this.mode === 'off' ? null : this.track).catch(() => {});
  }

  /* ---------- mic & modes ---------- */
  private async mic() {
    if (this.track && this.track.readyState === 'live') return true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(MIC);
      this.track = this.stream.getAudioTracks()[0];
      this.hookLocal(this.stream); this.set({ mic: 'ready' });
      return true;
    } catch (e) { console.warn('[voice] mic', e); this.set({ mic: 'blocked' }); return false; }
  }
  private apply() { if (this.track) this.track.enabled = this.mode === 'open' ? !this.muted : this.mode === 'ptt' ? this.pressing : false; }
  async setMode(m: VoiceMode) {
    this.mode = m;
    if (m !== 'off' && !(await this.mic())) return false;
    if (m === 'off') { this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null; this.track = null; this.localAn = null; this.set({ mic: 'none', meTalking: false }); }
    this.apply(); await this.attach();
    return true;
  }
  setMuted(m: boolean) { this.muted = m; this.apply(); }
  /** push-to-talk: hold. Over a direct link this opens the mic; without one it records a walkie-talkie clip */
  press(on: boolean) {
    this.pressing = on; this.apply();
    if (this.state.link === 'live' || !this.stream) return;
    if (on && !this.rec) {
      try {
        this.chunks = []; this.rec = new MediaRecorder(this.stream, { audioBitsPerSecond: 24000 });
        this.rec.ondataavailable = (e) => this.chunks.push(e.data); this.rec.start();
        setTimeout(() => this.rec?.state === 'recording' && this.rec.stop(), 20_000);
      } catch { this.rec = null; }
    }
  }
  /** finish a walkie-talkie clip (resolves to a data URL, or null if there was none / it was too short) */
  async endClip(): Promise<string | null> {
    const r = this.rec; this.rec = null;
    if (!r) return null;
    return new Promise((ok) => {
      r.onstop = () => {
        const blob = new Blob(this.chunks, { type: r.mimeType || 'audio/webm' });
        if (blob.size < 1500) return ok(null);
        const fr = new FileReader(); fr.onload = () => ok(fr.result as string); fr.readAsDataURL(blob);
      };
      r.state === 'recording' ? r.stop() : r.onstop!(new Event('stop'));
    });
  }
  unlock() { if (this.remote.srcObject && this.remote.paused) this.remote.play().catch(() => {}); this.ac?.resume().catch(() => {}); }

  /* ---------- who is talking (level meters) ---------- */
  private ctx() { return (this.ac ??= new AudioContext()); }
  private hookLocal(s: MediaStream) { try { const a = this.ctx().createAnalyser(); a.fftSize = 512; this.ctx().createMediaStreamSource(s).connect(a); this.localAn = a; } catch { /* */ } }
  private hookRemote(s: MediaStream) { try { const a = this.ctx().createAnalyser(); a.fftSize = 512; this.ctx().createMediaStreamSource(s).connect(a); this.remoteAn = a; } catch { /* */ } }
  private level(a: AnalyserNode | null) {
    if (!a) return 0;
    const b = new Float32Array(a.fftSize); a.getFloatTimeDomainData(b);
    let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i];
    return Math.sqrt(s / b.length);
  }
  private hold = { me: 0, them: 0 };
  private measure() {
    const now = performance.now();
    if (this.track?.enabled && this.level(this.localAn) > 0.02) this.hold.me = now + 350;
    if (this.state.link === 'live' && this.level(this.remoteAn) > 0.015) this.hold.them = now + 350;
    this.set({ meTalking: now < this.hold.me, themTalking: now < this.hold.them });
  }
  /** debug/test: is audio actually flowing? */
  async stats() {
    const out = { sent: 0, received: 0, level: 0, energy: 0 };
    const r = await this.pc?.getStats(); r?.forEach((s: any) => {
      if (s.type === 'outbound-rtp' && s.kind === 'audio') out.sent = s.bytesSent;
      if (s.type === 'inbound-rtp' && s.kind === 'audio') { out.received = s.bytesReceived; out.level = s.audioLevel ?? 0; out.energy = s.totalAudioEnergy ?? 0; }
    });
    return out;
  }
  close() {
    this.dead = true; clearTimeout(this.retry); clearInterval(this.meter); this.unsub();
    this.rec?.state === 'recording' && this.rec.stop();
    this.stream?.getTracks().forEach((t) => t.stop()); this.pc?.close();
    this.remote.srcObject = null; this.ac?.close().catch(() => {});
  }
}
