// In-game comms: text chat (messages also pop up as speech bubbles over your characters) and voice chat
// (off → push-to-talk → always-on mic). Lives inside the World, so it only runs while you're both in the game.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { Engine } from '../world/engine';
import { PEOPLE, type Who } from '../config/people';
import { addTo, getDoc, setDoc, watchCol } from '../lib/sync';
import { VoiceLink, type VoiceMode, type VoiceState } from '../lib/voice';
import { duckMusic, holdDuck } from '../audio/BiomeAudioManager';
import { sound } from '../world/sound';
import { buzz } from '../lib/fx';
import { spring } from './shell';

interface Msg { id: string; from: Who; text?: string; voice?: string; at: number }
const QUICK = ['come here 💗', 'look at this!', 'wait for me', 'race you!', 'hug? 🤗', 'brb', 'I love you', 'so pretty here ✨'];
const MODE_KEY = 'us:voice';
const loadMode = (): VoiceMode => { try { const m = localStorage.getItem(MODE_KEY); return m === 'ptt' || m === 'open' ? m : 'off'; } catch { return 'off'; } };

export function Comms({ eng, base, me, partner, toast }: { eng: Engine | null; base: string; me: Who; partner: Who; toast: (a: string, b?: string) => void }) {
  const voice = useRef<VoiceLink | null>(null);
  const [vs, setVs] = useState<VoiceState>({ link: 'idle', mic: 'none', meTalking: false, themTalking: false });
  const [mode, setMode] = useState<VoiceMode>('off'), [muted, setMuted] = useState(false), [pressing, setPressing] = useState(false);
  const [open, setOpen] = useState(false), [msgs, setMsgs] = useState<Msg[]>([]), [unread, setUnread] = useState(0), [txt, setTxt] = useState('');
  const engRef = useRef(eng); engRef.current = eng;
  const openRef = useRef(open); openRef.current = open;
  const list = useRef<HTMLDivElement>(null);

  /* ---------- voice link lifetime ---------- */
  useEffect(() => {
    const v = new VoiceLink(`${base}/rtc/voice`, me);
    voice.current = v; v.onState = setVs;
    const want = loadMode(); if (want !== 'off') v.setMode(want).then((ok) => setMode(ok ? want : 'off'));
    const u = () => v.unlock(); window.addEventListener('pointerdown', u);
    if (import.meta.env.DEV) Object.assign(window, { __voice: v });
    return () => { window.removeEventListener('pointerdown', u); v.close(); voice.current = null; };
  }, [base, me]);
  useEffect(() => { engRef.current?.talking(me, vs.meTalking); }, [vs.meTalking, eng]); // eslint-disable-line
  useEffect(() => { engRef.current?.talking(partner, vs.themTalking); if (vs.themTalking) holdDuck(true); else holdDuck(false); }, [vs.themTalking, eng]); // eslint-disable-line

  const cycle = async () => {
    const next: VoiceMode = mode === 'off' ? 'ptt' : mode === 'ptt' ? 'open' : 'off';
    const ok = await voice.current?.setMode(next);
    if (!ok && next !== 'off') { toast('🎙️ Microphone blocked', 'Allow the microphone for us!! in your phone settings'); sound('miss'); return; }
    setMode(next); setMuted(false); voice.current?.setMuted(false);
    try { localStorage.setItem(MODE_KEY, next); } catch { /* */ }
    sound('select'); buzz('light');
    toast(next === 'off' ? '🔇 Voice off' : next === 'ptt' ? '📻 Push to talk' : '🎙️ Mic always on', next === 'off' ? 'Your mic is closed' : next === 'ptt' ? 'Hold the TALK button while you speak' : 'Talk freely, tap to mute');
  };
  const talk = async (on: boolean) => {
    if (mode !== 'ptt' || on === pressing) return;
    setPressing(on); voice.current?.press(on); buzz(on ? 'medium' : 'light'); sound(on ? 'tick' : 'click', { vol: 0.6 });
    if (!on) {   // a clip recorded while there was no direct link is always finished and sent (even if the link came back)
      const data = await voice.current?.endClip();
      if (!data) return;
      const id = 'v' + Date.now().toString(36);
      await setDoc(`${base}/blobs/${id}`, { data, at: Date.now() }, false);
      await addTo(`${base}/chat`, { from: me, voice: id, at: Date.now() });
      toast('📻 Voice clip sent', `${PEOPLE[partner].name} hears it right away`);
    }
  };

  /* ---------- chat ---------- */
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => watchCol(`${base}/chat`, 40, (rows) => {
    const ms = (rows as Msg[]).slice().sort((a, b) => a.at - b.at);
    setMsgs(ms);
    if (!seen.current) { seen.current = new Set(ms.map((m) => m.id)); return; }    // history: no bubbles
    for (const m of ms) {
      if (seen.current.has(m.id)) continue;
      seen.current.add(m.id);
      if (m.text) engRef.current?.say(m.from, m.text);
      if (m.from === partner) {
        if (!openRef.current) setUnread((n) => n + 1);
        if (m.voice && Date.now() - m.at < 120_000) playClip(m.voice);
        else sound('notify', { vol: 0.7 });
      }
    }
  }), [base]); // eslint-disable-line
  useEffect(() => { if (open) { setUnread(0); requestAnimationFrame(() => list.current?.scrollTo({ top: 1e6 })); } }, [open, msgs.length]);
  const playClip = async (id: string) => {
    const d = await getDoc(`${base}/blobs/${id}`); if (!d?.data) return;
    const a = new Audio(d.data); engRef.current?.talking(partner, true); holdDuck(true);
    const done = () => { engRef.current?.talking(partner, false); holdDuck(false); };
    a.onended = done; a.onerror = done; a.play().catch(done);
  };
  const sendText = (t: string) => {
    const text = t.trim().slice(0, 240); if (!text) return;
    addTo(`${base}/chat`, { from: me, text, at: Date.now() }); setTxt(''); sound('pop'); duckMusic(300);
  };

  const status = mode === 'off' ? '' : vs.mic === 'blocked' ? 'mic blocked' : vs.link === 'live' ? (vs.themTalking ? `${PEOPLE[partner].name} is talking` : 'voice connected') : mode === 'ptt' ? 'clips mode (no direct link yet)' : 'connecting voice…';
  return (
    <>
      <div className="hud comms">
        <button className={'cbtn' + (open ? ' on' : '')} onClick={() => { setOpen(!open); sound(open ? 'close' : 'open'); }} aria-label="Chat">
          💬{unread > 0 && !open && <b className="cnt">{unread}</b>}
        </button>
        <button className={'cbtn mode m-' + mode} onClick={cycle} aria-label="Voice mode">
          {mode === 'off' ? '🔇' : mode === 'ptt' ? '📻' : '🎙️'}<small>{mode === 'off' ? 'voice' : mode === 'ptt' ? 'push' : 'open'}</small>
        </button>
        {mode === 'ptt' && (
          <button className={'cbtn talk' + (pressing ? ' on' : '')} style={{ touchAction: 'none' }}
            onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); talk(true); }} onPointerUp={() => talk(false)} onPointerCancel={() => talk(false)}>
            {pressing ? '● ON AIR' : 'HOLD TO TALK'}
          </button>
        )}
        {mode === 'open' && (
          <button className={'cbtn talk' + (muted ? '' : ' on')} onClick={() => { const m = !muted; setMuted(m); voice.current?.setMuted(m); sound('tick'); }}>
            {muted ? '🔇 MUTED' : vs.meTalking ? '● LIVE' : '🎙️ LIVE'}
          </button>
        )}
        {status && <div className={'vstat' + (vs.link === 'live' ? ' ok' : '')}>{status}</div>}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="chat glass" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={spring}>
            <div className="row"><b className="grow">💬 Chat with {PEOPLE[partner].name}</b><button className="pill" onClick={() => setOpen(false)}>✕</button></div>
            <div className="chat-list" ref={list}>
              {!msgs.length && <div className="small muted">Say hi! Messages also pop up over your characters.</div>}
              {msgs.map((m) => (
                <div key={m.id} className={'msg' + (m.from === me ? ' me' : '')}>
                  {m.voice ? <button className="pill" onClick={() => playClip(m.voice!)}>▶︎ voice clip</button> : m.text}
                </div>
              ))}
            </div>
            <div className="row wrap quick">{QUICK.map((q) => <button key={q} className="pill" onClick={() => sendText(q)}>{q}</button>)}</div>
            <form className="row" onSubmit={(e) => { e.preventDefault(); sendText(txt); }}>
              <input className="field grow" value={txt} maxLength={240} placeholder="Type a message…" onChange={(e) => setTxt(e.target.value)} />
              <button className="btn" type="submit" disabled={!txt.trim()}>Send</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
