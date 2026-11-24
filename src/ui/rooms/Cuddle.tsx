import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { useRef, useState } from 'react';
import { PLUSHIES, ROOM_MODES } from '../../config/content';
import { PEOPLE } from '../../config/people';
import { buzz, sfx } from '../../lib/fx';
import { useShared, useVelvet } from '../../lib/velvet';
import { Avatar, Tap, spring } from '../shell';
import { HoldToRecord, VoicePlay } from './Checkup';

type P = (typeof PLUSHIES)[number];
type Hidden = { from: string; text?: string; voice?: string; at: number; opened?: boolean };
type Letter = { from: string; when: string; text: string; at: number; opened?: number };
const WHENS = ['you miss me', "you can't sleep", 'you need a laugh', 'you feel sad', 'we had a silly fight', "you're proud of yourself", "it's our monthiversary"];

/** "Open When…" sealed envelopes: write one for your partner, they open it only when the moment comes */
function OpenWhen() {
  const { me, partner, send, toast } = useVelvet();
  const [letters, setLetters] = useShared<Record<string, Letter>>('openwhen');
  const [when, setWhen] = useState(WHENS[0]), [text, setText] = useState(''), [read, setRead] = useState<Letter | null>(null);
  const all = Object.entries(letters ?? {}).filter(([, l]) => l && l.when).sort((a, b) => b[1].at - a[1].at);
  const mine = all.filter(([, l]) => l.from !== me), sent = all.filter(([, l]) => l.from === me);
  const seal = () => { const id = 'o' + Date.now().toString(36); setLetters({ [id]: { from: me, when, text: text.trim(), at: Date.now() } }); send('openwhen', when); sfx('shimmer'); toast('💌 Sealed', `${PEOPLE[partner].name} can open it when ${when}`); setText(''); };
  return (
    <>
      <div className="section-title"><h3>💌 Open When…</h3><span className="small muted">sealed letters</span></div>
      {mine.length ? (
        <div className="row wrap">
          {mine.map(([id, l]) => (
            <Tap key={id} className={'opt' + (l.opened ? '' : ' on')} onClick={() => { setRead(l); if (!l.opened) setLetters({ [id]: { opened: Date.now() } }); sfx('shimmer'); buzz([20, 30, 20]); }}>
              <b>{l.opened ? '📖' : '💌'} Open when {l.when}</b>
            </Tap>
          ))}
        </div>
      ) : <div className="small muted">No letters from {PEOPLE[partner].name} yet.</div>}
      <div className="glass card col">
        <b>Write one for {PEOPLE[partner].name}</b>
        <div className="row wrap">{WHENS.map((w) => <Tap key={w} className={'pill' + (when === w ? ' on' : '')} onClick={() => setWhen(w)}>{w}</Tap>)}</div>
        <textarea className="field" rows={3} placeholder={`Open when ${when}…`} value={text} maxLength={600} onChange={(e) => setText(e.target.value)} />
        <Tap className="btn" disabled={!text.trim()} onClick={seal}>Seal it 💌</Tap>
        {!!sent.length && <div className="small muted">You sealed {sent.length}: {sent.map(([, l]) => `${l.opened ? '📖' : '💌'} ${l.when}`).join(' · ')}</div>}
      </div>
      <AnimatePresence>
        {read && (
          <div className="sheet-bg" style={{ alignItems: 'center', justifyContent: 'center' }} onClick={() => setRead(null)}>
            <motion.div className="glass card col center" style={{ width: '84%' }} onClick={(e) => e.stopPropagation()} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={spring}>
              <div style={{ fontSize: 34 }}>💌</div>
              <div className="small muted">Open when {read.when} · from {PEOPLE[read.from as 'arushi']?.name}</div>
              <h3 style={{ whiteSpace: 'pre-wrap' }}>{read.text}</h3>
              <Tap className="btn ghost" onClick={() => setRead(null)}>Fold it back 💗</Tap>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

/** original SVG plushies: bunny ears for Kuro/Mochi (Kuro wears a little jester cap), round ears for Coco */
export function PlushieArt({ p, size = 150 }: { p: P; size?: number }) {
  const bear = p.id === 'coco';
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {bear ? (
        <><circle cx="32" cy="34" r="14" fill={p.ear} /><circle cx="88" cy="34" r="14" fill={p.ear} /></>
      ) : (
        <><ellipse cx="42" cy="26" rx="10" ry="26" fill={p.body} transform="rotate(-12 42 26)" /><ellipse cx="78" cy="26" rx="10" ry="26" fill={p.body} transform="rotate(12 78 26)" />
          <ellipse cx="42" cy="28" rx="5" ry="18" fill={p.ear} transform="rotate(-12 42 28)" /><ellipse cx="78" cy="28" rx="5" ry="18" fill={p.ear} transform="rotate(12 78 28)" /></>
      )}
      <ellipse cx="60" cy="72" rx="40" ry="38" fill={p.body} />
      {p.id === 'kuro' && <><path d="M30 46 Q60 22 90 46 Q60 38 30 46Z" fill="#FF3E8A" /><circle cx="60" cy="31" r="4" fill="#F2C59B" /></>}
      <ellipse cx="44" cy="70" rx="5" ry={bear ? 4 : 6} fill={p.eye} /><ellipse cx="76" cy="70" rx="5" ry={bear ? 4 : 6} fill={p.eye} />
      {bear && <path d="M38 66 q6 -4 12 0 M70 66 q6 -4 12 0" stroke={p.eye} strokeWidth="2.5" fill="none" />}
      <ellipse cx="34" cy="82" rx="7" ry="4" fill={p.cheek} opacity=".7" /><ellipse cx="86" cy="82" rx="7" ry="4" fill={p.cheek} opacity=".7" />
      <path d="M54 82 q6 6 12 0" stroke={p.eye} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {p.id === 'kuro' && <path d="M60 96 l-5 6 h10z" fill="#FF3E8A" />}
    </svg>
  );
}

function Plushie({ p, hidden, onZip, onTuck }: { p: P; hidden?: Hidden; onZip: () => void; onTuck: () => void }) {
  const { send, toast, partner, me } = useVelvet();
  const ctl = useAnimationControls();
  const t = useRef<number>(); const last = useRef(0);
  const press = () => {
    ctl.start({ scaleX: 1.18, scaleY: 0.8, transition: { type: 'spring', stiffness: 600, damping: 12 } }); sfx('squeak'); buzz('medium');
    t.current = window.setTimeout(() => {
      if (Date.now() - last.current < 8000) return;
      last.current = Date.now(); send('squeeze', p.name); buzz([30, 40, 30, 40, 90]); toast(`🧸 Squeezing ${p.name}`, `${PEOPLE[partner].name} gets a cuddle alert`);
    }, 700);
  };
  const release = () => { clearTimeout(t.current); ctl.start({ scaleX: [0.9, 1.06, 1], scaleY: [1.12, 0.96, 1], transition: { duration: 0.55 } }); };
  const forMe = hidden && hidden.from !== me && !hidden.opened;
  return (
    <div className="glass card col center" style={{ alignItems: 'center', gap: 6 }}>
      <motion.div animate={ctl} onPointerDown={press} onPointerUp={release} onPointerLeave={release} style={{ touchAction: 'none', transformOrigin: '50% 90%', position: 'relative' }}
        whileHover={{ rotate: [0, -3, 3, 0] }}>
        <PlushieArt p={p} size={128} />
        {forMe && (
          <motion.button onClick={(e) => { e.stopPropagation(); onZip(); }} onPointerDown={(e) => e.stopPropagation()} style={{ position: 'absolute', left: '50%', top: '62%', marginLeft: -18, fontSize: 30 }}
            animate={{ scale: [1, 1.25, 1], filter: ['drop-shadow(0 0 4px #FF3E8A)', 'drop-shadow(0 0 14px #FF3E8A)', 'drop-shadow(0 0 4px #FF3E8A)'] }} transition={{ repeat: Infinity, duration: 1.2 }}>💗</motion.button>
        )}
      </motion.div>
      <b>{p.name}</b><span className="small muted">{p.title}</span>
      <Tap className="pill small" onClick={onTuck}>🤐 Hide something inside</Tap>
    </div>
  );
}

export function Cuddle() {
  const { me, partner, states, setMe, send, toast } = useVelvet();
  const [zip, setZip] = useShared<Record<string, Hidden>>('zipper');
  const [open, setOpen] = useState<P | null>(null);
  const [tuck, setTuck] = useState<P | null>(null);
  const [txt, setTxt] = useState('');
  const hide = (p: P, h: Partial<Hidden>) => { setZip({ [p.id]: { from: me, at: Date.now(), opened: false, text: '', voice: '', ...h } }); send('zipper', p.name); sfx('shimmer'); toast(`🤐 Hidden inside ${p.name}`); setTuck(null); setTxt(''); };
  const modes = [states[me].roomMode, states[partner].roomMode].map((m) => ROOM_MODES.find((x) => x.id === m) ?? ROOM_MODES[0]);
  const z = open ? zip?.[open.id] : null;
  return (
    <div className="col">
      <h2>Cuddle Corner</h2>
      <div className="small muted">Poke to squish. Hold to squeeze — {PEOPLE[partner].name} feels it.</div>
      <div className="grid2">{PLUSHIES.map((p) => <Plushie key={p.id} p={p} hidden={zip?.[p.id]} onTuck={() => setTuck(p)} onZip={() => { setOpen(p); setZip({ [p.id]: { opened: true } }); sfx('shimmer'); buzz([20, 30, 20, 30, 20]); }} />)}</div>

      <OpenWhen />

      <div className="section-title"><h3>Our Mini Room</h3><span className="small muted">live lighting</span></div>
      <motion.div className="glass" style={{ height: 190, position: 'relative', overflow: 'hidden' }}
        animate={{ background: `radial-gradient(circle at 25% 30%, ${modes[0].light}55, transparent 60%), radial-gradient(circle at 75% 30%, ${modes[1].light}55, transparent 60%), #1a0a14` }} transition={{ duration: 1.2 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 50, background: 'linear-gradient(#3a1630,#22091a)' }} />
        <div style={{ position: 'absolute', top: 14, left: '50%', marginLeft: -40, width: 80, height: 50, borderRadius: 8, border: '3px solid #4a1d3c', background: modes[1].id === 'sleepy' || modes[0].id === 'sleepy' ? '#120a2a' : '#2b2150', display: 'grid', placeItems: 'center' }}>{modes.some((m) => m.id === 'sleepy') ? '🌙' : '✨'}</div>
        {[me, partner].map((w, i) => (
          <motion.div key={w} style={{ position: 'absolute', bottom: 34, left: i ? '58%' : '12%', width: 70, height: 90, display: 'grid', placeItems: 'end center' }}
            animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 2.6, delay: i }}>
            <div className="portrait" style={{ width: 56, height: 74, ['--tint' as any]: PEOPLE[w].aura }}><Avatar who={w} st={states[w]} /></div>
            <span className="small">{modes[i].id === 'missing' ? '💭💗' : modes[i].id === 'busy' ? '📚' : modes[i].id === 'sleepy' ? '💤' : '☕'}</span>
          </motion.div>
        ))}
        <div style={{ position: 'absolute', bottom: 4, left: '38%' }}><PlushieArt p={PLUSHIES[0]} size={44} /></div>
        <div style={{ position: 'absolute', bottom: 4, right: 6 }}><PlushieArt p={PLUSHIES[2]} size={40} /></div>
      </motion.div>
      <div className="row wrap">{ROOM_MODES.map((m) => <Tap key={m.id} className={'pill' + (states[me].roomMode === m.id ? ' on' : '')} onClick={() => { setMe({ roomMode: m.id }); send('room', m.label); }}>{m.label}</Tap>)}</div>

      <AnimatePresence>
        {tuck && (
          <div className="sheet-bg" onClick={() => setTuck(null)}>
            <motion.div className="glass sheet col" onClick={(e) => e.stopPropagation()} initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={spring}>
              <h3>Hide something inside {tuck.name}</h3>
              <textarea className="field" rows={3} placeholder="A tiny letter, a cheeky dare, a secret…" value={txt} onChange={(e) => setTxt(e.target.value)} />
              <Tap className="btn" disabled={!txt.trim()} onClick={() => hide(tuck, { text: txt.trim() })}>Zip it inside 🤐</Tap>
              <HoldToRecord label="🎙️ Or hold to hide a voice note" onDone={(id) => hide(tuck, { voice: id })} />
            </motion.div>
          </div>
        )}
        {open && z && (
          <div className="sheet-bg" style={{ alignItems: 'center', justifyContent: 'center' }} onClick={() => setOpen(null)}>
            <motion.div className="glass card col center" style={{ width: '84%' }} onClick={(e) => e.stopPropagation()} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={spring}>
              <div style={{ fontSize: 34 }}>💌</div>
              <div className="small muted">Found inside {open.name} · from {PEOPLE[z.from as 'arushi']?.name}</div>
              {z.text && <h3>{z.text}</h3>}
              {z.voice && <VoicePlay id={z.voice} />}
              <Tap className="btn ghost" onClick={() => setOpen(null)}>Zip it back up</Tap>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
