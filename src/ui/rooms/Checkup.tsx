import { holdDuck } from '../../audio/BiomeAudioManager';
import { motion, useAnimationControls } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { COUPONS, NEEDS, TONES } from '../../config/content';
import { PEOPLE } from '../../config/people';
import { buzz, sfx } from '../../lib/fx';
import { startRecording } from '../../lib/media';
import { addTo, getDoc } from '../../lib/sync';
import { describe, useShared, useVelvet, type Ev } from '../../lib/velvet';
import { Tap, spring } from '../shell';

export const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : new Date(t).toLocaleDateString();
};

export function VoicePlay({ id }: { id: string }) {
  const { base } = useVelvet();
  const [src, setSrc] = useState<string | null>(null);
  return src ? <audio controls autoPlay src={src} onPlay={() => holdDuck(true)} onPause={() => holdDuck(false)} onEnded={() => holdDuck(false)} /> : <Tap className="pill" onClick={async () => setSrc((await getDoc(`${base}/blobs/${id}`))?.data ?? null)}>▶︎ Play voice note</Tap>;
}

const Toggle = ({ on, label, set }: { on: boolean; label: string; set: (v: boolean) => void }) => <Tap className={'pill' + (on ? ' on' : '')} onClick={() => set(!on)}>{label}</Tap>;

export function Checkup() {
  const { me, partner, send, toast, setMe, events, states } = useVelvet();
  const [energy, setEnergy] = useState(states[me].energy ?? 60);
  const [v, setV] = useState({ water: false, food: false, sleep: false, headache: false, cramps: false });
  const [needs, setNeeds] = useState<string[]>([]);
  const P = PEOPLE[partner].name;

  const submit = () => {
    const bits = [`⚡ ${energy}%`, v.water && '💧 water', v.food && '🍱 ate', v.sleep && '😴 slept well', v.headache && '🤕 headache', v.cramps && '🌡️ cramps'].filter(Boolean).join(' · ');
    setMe({ energy });
    send('checkup', bits + (needs.length ? ` · needs: ${needs.join(', ')}` : ''), { energy, ...v, needs });
    sfx('shimmer'); toast('📋 Checkup sent', `${P} sees it now`);
  };
  const inbox = events.filter((e) => e.from === partner && ['tell', 'bothered', 'need', 'rx', 'reply', 'flare', 'checkup'].includes(e.type)).slice(0, 8);

  return (
    <div className="col">
      <h2>Us Checkup & Open Heart</h2>
      <div className="glass card col">
        <div className="row"><b className="grow">Energy battery</b><span className="tag">{energy}%</span></div>
        <input type="range" min={5} max={100} step={5} value={energy} onChange={(e) => setEnergy(+e.target.value)} />
        <div className="row wrap">
          <Toggle on={v.water} label="💧 Water" set={(x) => setV({ ...v, water: x })} />
          <Toggle on={v.food} label="🍱 Ate" set={(x) => setV({ ...v, food: x })} />
          <Toggle on={v.sleep} label="😴 Slept" set={(x) => setV({ ...v, sleep: x })} />
          <Toggle on={v.headache} label="🤕 Headache" set={(x) => setV({ ...v, headache: x })} />
          <Toggle on={v.cramps} label="🌡️ Cramps" set={(x) => setV({ ...v, cramps: x })} />
        </div>
        <b>What I need from you right now</b>
        <div className="row wrap">{NEEDS.map((n) => <Toggle key={n} on={needs.includes(n)} label={n} set={(x) => setNeeds(x ? [...needs, n] : needs.filter((y) => y !== n))} />)}</div>
        <div className="row">
          <Tap className="btn grow" onClick={submit}>Send 30-sec checkup</Tap>
          <Tap className="btn ghost" disabled={!needs.length} onClick={() => { send('need', needs.join(' · ')); toast('🫶 Sent', `${P} knows what you need`); }}>Need</Tap>
        </div>
      </div>

      <Bothered />
      <TellSomething />
      <FlareButton />
      <Prescriptions />

      <div className="section-title"><h3>From {P}</h3><span className="small muted">live</span></div>
      {inbox.length === 0 && <div className="muted small">Nothing yet. It shows up here the second {P} sends something.</div>}
      {inbox.map((e: Ev) => {
        const [t, b] = describe(e);
        return (
          <motion.div key={e.id} layout className="glass card col" style={{ gap: 6, borderColor: e.type === 'flare' || e.type === 'bothered' ? 'var(--crimson)' : undefined }}>
            <div className="row"><b className="grow">{t}</b><span className="small muted">{ago(e.at)}</span></div>
            {b && <div className="muted">{b}</div>}
            {e.data?.voice && <VoicePlay id={e.data.voice} />}
          </motion.div>
        );
      })}
    </div>
  );
}

function Bothered() {
  const { send, toast, partner } = useVelvet();
  const [txt, setTxt] = useState('');
  const [tone, setTone] = useState(TONES[0]);
  return (
    <div className="glass card col">
      <b>Is anything bothering you?</b>
      <textarea className="field" rows={2} placeholder="Even tiny things count…" value={txt} onChange={(e) => setTxt(e.target.value)} />
      <div className="row wrap">{TONES.map((t) => <Tap key={t} className={'pill' + (tone === t ? ' on' : '')} onClick={() => setTone(t)}>{t}</Tap>)}</div>
      <Tap className="btn" disabled={!txt.trim()} onClick={() => { send('bothered', txt.trim(), { tone }); setTxt(''); toast('💗 Sent gently', `${PEOPLE[partner].name} gets a priority alert`); }}>Something is bothering me…</Tap>
    </div>
  );
}

/** hold-to-record button: uploads the clip to blobs/ and returns its id */
export function HoldToRecord({ onDone, label = '🎙️ Hold to record a voice note' }: { onDone: (id: string) => void; label?: string }) {
  const { toast, base } = useVelvet();
  const [rec, setRec] = useState(false);
  const stop = useRef<null | (() => Promise<string | null>)>(null);
  const begin = async () => {
    try { stop.current = await startRecording(); setRec(true); buzz('medium'); } catch { toast('Mic blocked', 'Allow microphone to send voice notes'); }
  };
  const end = async () => {
    if (!stop.current) return;
    setRec(false); const data = await stop.current(); stop.current = null;
    if (!data) return toast('Too short', 'Hold the button while you talk');
    onDone(await addTo(`${base}/blobs`, { data, at: Date.now() }));
  };
  return (
    <motion.button className="btn ghost" animate={{ scale: rec ? [1, 1.05, 1] : 1 }} transition={{ repeat: rec ? Infinity : 0, duration: 0.8 }}
      onPointerDown={begin} onPointerUp={end} onPointerLeave={() => rec && end()} style={{ touchAction: 'none', borderColor: rec ? 'var(--blush)' : undefined }}>
      {rec ? '● Recording… release to send' : label}
    </motion.button>
  );
}

function TellSomething() {
  const { send, toast } = useVelvet();
  const [txt, setTxt] = useState('');
  return (
    <div className="glass card col">
      <b>I want to tell you something…</b>
      <div className="row">
        <input className="field grow" placeholder="Type it…" value={txt} onChange={(e) => setTxt(e.target.value)} />
        <Tap className="btn" disabled={!txt.trim()} onClick={() => { send('tell', txt.trim()); setTxt(''); toast('💌 Sent'); }}>Send</Tap>
      </div>
      <HoldToRecord onDone={(id) => { send('tell', '🎙️ voice note', { voice: id }); toast('🎙️ Voice note sent'); }} />
    </div>
  );
}

function FlareButton() {
  const { send, toast, partner } = useVelvet();
  const ctl = useAnimationControls();
  const timer = useRef<number>();
  const down = () => {
    buzz('light'); ctl.start({ scaleX: 1, transition: { duration: 1.4, ease: 'linear' } });
    timer.current = window.setTimeout(() => { send('flare'); sfx('flare'); buzz([120, 80, 120]); toast('🚨 Comfort Flare sent', `${PEOPLE[partner].name}'s phone is pulsing`); ctl.set({ scaleX: 0 }); }, 1400);
  };
  const up = () => { clearTimeout(timer.current); ctl.start({ scaleX: 0, transition: { duration: 0.25 } }); };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button className="flare" onPointerDown={down} onPointerUp={up} onPointerLeave={up} style={{ touchAction: 'none' }}>
      <motion.div className="fill" initial={{ scaleX: 0 }} animate={ctl} />
      <span>🚨 Need You Flare — long-press</span>
    </button>
  );
}

type Coupon = { title: string; note?: string; from: string; to: string; at: number; status: 'active' | 'redeemed'; redeemedAt?: number };
function Prescriptions() {
  const { me, partner, send, toast } = useVelvet();
  const [all, save] = useShared<Record<string, Coupon>>('coupons');
  const [rx, setRx] = useState('');
  const [pick, setPick] = useState(COUPONS[0]);
  const list = Object.entries(all ?? {}).sort((a, b) => b[1].at - a[1].at);
  const mine = list.filter(([, c]) => c.to === me);
  return (
    <div className="glass card col">
      <div className="row"><b className="grow">🩺 {PEOPLE[me].doc}'s Prescription Pad</b></div>
      <textarea className="field" rows={2} placeholder={`Rx for ${PEOPLE[partner].name}: drink water, sleep by 11, think of me 3x daily…`} value={rx} onChange={(e) => setRx(e.target.value)} />
      <div className="row wrap">{COUPONS.map((c) => <Tap key={c} className={'pill' + (pick === c ? ' on' : '')} onClick={() => setPick(c)}>{c}</Tap>)}</div>
      <Tap className="btn" onClick={() => {
        const id = Date.now().toString(36);
        save({ [id]: { title: pick, note: rx.trim(), from: me, to: partner, at: Date.now(), status: 'active' } });
        if (rx.trim()) send('rx', rx.trim());
        send('coupon', pick, { id }); setRx(''); sfx('shimmer'); toast('🎟️ Prescribed', pick);
      }}>Prescribe + send coupon</Tap>
      {mine.length > 0 && <b>Your coupon wallet</b>}
      {mine.map(([id, c]) => (
        <motion.div key={id} layout className="coupon row" style={{ opacity: c.status === 'redeemed' ? 0.5 : 1 }} transition={spring}>
          <div className="grow"><b>{c.title}</b><div className="small muted">from Dr. {PEOPLE[c.from as 'shaurya'].name}{c.note ? ` · “${c.note}”` : ''}</div></div>
          {c.status === 'active'
            ? <Tap className="btn" onClick={() => { save({ [id]: { status: 'redeemed', redeemedAt: Date.now() } }); send('redeem', c.title, { id }); sfx('shimmer'); }}>Redeem</Tap>
            : <span className="tag">redeemed</span>}
        </motion.div>
      ))}
    </div>
  );
}
