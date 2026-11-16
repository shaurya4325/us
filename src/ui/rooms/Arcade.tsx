import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { CHEEKY, COUPONS, CRIMES, DEEP, FINISH, LIKELY, SCRATCH, SPECTRA, VERDICTS } from '../../config/content';
import { PEOPLE, type Who } from '../../config/people';
import { buzz, sfx } from '../../lib/fx';
import { useShared, useVelvet } from '../../lib/velvet';
import { Tap, spring } from '../shell';

type G = Record<string, any>;
const GAMES = [
  { tier: 'Live Co-op', items: [['bridge', '💞 Heart-Bridge Rhythm'], ['wave', '📡 Wavelength Dial']] },
  { tier: 'Tier 1 · Sweet & Cute', items: [['likely', '🃏 Who’s More Likely'], ['finish', '✍️ Finish My Sentence']] },
  { tier: 'Tier 2 · Playful Teasing', items: [['court', '⚖️ Court of Love'], ['teases', '😈 Live Screen Teases']] },
  { tier: 'Tier 3 · Read Between the Lines', items: [['cheeky', '😏 Guess My Answer'], ['scratch', '🪙 Gold-Foil Scratch Cards']] },
  { tier: 'Tier 4 · Deep Heart 🔒', items: [['deep', '🌌 Deep Questions'], ['confess', '🗝️ Wishes & Confessions'], ['heart', '💓 Heartbeat Sync']], locked: true },
];
const PIN = import.meta.env.VITE_DEEP_PIN || '0807';

export function Arcade() {
  const { send, me } = useVelvet();
  const [g, setG] = useShared<G>('game');
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('vu:pin') === '1');
  const [pin, setPin] = useState('');
  const start = (kind: string, label: string, extra: G = {}) => { setG({ kind, at: Date.now(), by: me, ...extra }, false); send('game', label); sfx('pop'); };
  if (g?.kind && g.kind !== 'none') {
    return (
      <div className="col">
        <div className="row"><Tap className="pill" onClick={() => setG({ kind: 'none' }, false)}>← Arcade</Tap><span className="grow" /></div>
        <GameView g={g} set={setG} />
      </div>
    );
  }
  return (
    <div className="col">
      <h2>The Velvet Arcade</h2>
      <div className="small muted">Every game is live on both phones. Start one and it opens for both of you.</div>
      {GAMES.map((t) => (
        <div key={t.tier} className="col" style={{ gap: 8 }}>
          <div className="section-title" style={{ margin: '10px 2px 0' }}><h3>{t.tier}</h3></div>
          {t.locked && !unlocked ? (
            <div className="glass card row">
              <input className="field grow" type="password" inputMode="numeric" placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
              <Tap className="btn" onClick={() => { if (pin === PIN) { setUnlocked(true); sessionStorage.setItem('vu:pin', '1'); sfx('shimmer'); } else buzz([60, 60, 60]); }}>Unlock</Tap>
            </div>
          ) : (
            <div className="grid2">
              {t.items.map(([k, label]) => (
                <Tap key={k} className="glass card" style={{ textAlign: 'left', minHeight: 70 }} onClick={() => start(k, label, init(k))}>
                  <b>{label}</b>
                </Tap>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const rnd = (n: number) => Math.floor(Math.random() * n);
function init(kind: string): G {
  if (kind === 'bridge') return { startAt: Date.now() + 4000, hits: {} };
  if (kind === 'wave') return { s: rnd(SPECTRA.length), target: 5 + rnd(90), phase: 'clue' };
  if (kind === 'court') return { crime: rnd(CRIMES.length) };
  if (['likely', 'finish', 'cheeky', 'deep'].includes(kind)) return { i: rnd(50) };
  return {};
}

function GameView({ g, set }: { g: G; set: (d: G, merge?: boolean) => void }) {
  switch (g.kind) {
    case 'bridge': return <Bridge g={g} set={set} />;
    case 'wave': return <Wave g={g} set={set} />;
    case 'likely': return <BlindPick g={g} set={set} />;
    case 'finish': return <BlindText g={g} set={set} deck={FINISH} title="Finish My Sentence" />;
    case 'cheeky': return <BlindText g={g} set={set} deck={CHEEKY} title="Guess My Answer" hint="Both answer, then compare. Closest guess wins a compliment." />;
    case 'deep': return <BlindText g={g} set={set} deck={DEEP} title="Deep Questions" hint="No rush. Answers reveal only when you both submit." />;
    case 'court': return <Court g={g} set={set} />;
    case 'teases': return <Teases />;
    case 'scratch': return <Scratch />;
    case 'confess': return <Confess g={g} set={set} />;
    case 'heart': return <Heartbeat g={g} set={set} />;
    default: return null;
  }
}

/* ---------- Heart-Bridge Rhythm Sync ---------- */
const BEAT = 900, BEATS = 36, WINDOW = 230, TRAVEL = 2600;
function Bridge({ g, set }: { g: G; set: (d: G) => void }) {
  const { me, partner } = useVelvet();
  const [now, setNow] = useState(Date.now());
  const mine = useRef<number[]>(g.hits?.[me] ?? []);
  useEffect(() => { let r = 0; const f = () => { setNow(Date.now()); r = requestAnimationFrame(f); }; r = requestAnimationFrame(f); return () => cancelAnimationFrame(r); }, []);
  const sent = useRef(-1);
  useEffect(() => { mine.current = []; sent.current = -1; }, [g.startAt]);
  useEffect(() => { const t = setInterval(() => { if (sent.current !== mine.current.length) { sent.current = mine.current.length; set({ hits: { [me]: mine.current } }); } }, 1200); return () => clearInterval(t); }, [me, set]);
  const arrival = (i: number) => g.startAt + TRAVEL + i * BEAT;
  const tap = () => {
    const i = Math.round((Date.now() - g.startAt - TRAVEL) / BEAT);
    if (i >= 0 && i < BEATS && Math.abs(Date.now() - arrival(i)) < WINDOW && !mine.current.includes(i)) { mine.current = [...mine.current, i]; sfx('pop'); buzz('light'); }
    else buzz([15]);
  };
  const theirs: number[] = g.hits?.[partner] ?? [];
  const both = mine.current.filter((i) => theirs.includes(i));
  let combo = 0; for (let i = BEATS - 1; i >= 0; i--) { if (arrival(i) > now) continue; if (both.includes(i)) combo++; else if (arrival(i) < now - 2000) break; }
  const done = now > arrival(BEATS - 1) + 1500;
  return (
    <div className="col">
      <h2>Heart-Bridge Rhythm</h2>
      <div className="small muted">Tap when a heart reaches the glowing ring — together. Hits you both land build Love Resonance.</div>
      <div className="glass" onPointerDown={tap} style={{ height: 260, position: 'relative', overflow: 'hidden', touchAction: 'none' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 128, height: 4, background: 'linear-gradient(90deg,var(--rose),var(--blush),var(--gold))', opacity: 0.6 }} />
        <div className="small" style={{ position: 'absolute', left: 10, top: 10 }}>{PEOPLE[me].name}</div>
        <div className="small" style={{ position: 'absolute', right: 10, top: 10 }}>{PEOPLE[partner].name}</div>
        <motion.div className="ring" style={{ left: '50%', top: 106, width: 48, height: 48, marginLeft: -24, borderColor: 'var(--blush)' }} animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: BEAT / 1000 }} />
        {Array.from({ length: BEATS }, (_, i) => {
          const p = 1 - (arrival(i) - now) / TRAVEL; // 0 → 1 at ring
          if (p < 0 || p > 1.5) return null;
          const hitM = mine.current.includes(i), hitP = theirs.includes(i);
          return <div key={i} style={{ position: 'absolute', top: 112, left: `calc(${p * 50}% - 14px)`, fontSize: 28, opacity: hitM ? 0.25 : 1, transform: `scale(${hitM && hitP ? 1.6 : 1})`, filter: hitM && hitP ? 'drop-shadow(0 0 10px #F2C59B)' : undefined }}>{hitM && hitP ? '💖' : '❤️'}</div>;
        })}
        {now < g.startAt + TRAVEL && <div className="center" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 40 }}>{Math.max(1, Math.ceil((g.startAt + TRAVEL - now) / 1000))}</div>}
      </div>
      <div className="grid2">
        <div className="glass card center"><div className="small muted">Love Resonance</div><h2>{both.length}</h2></div>
        <div className="glass card center"><div className="small muted">Combo</div><h2>×{combo}</h2></div>
      </div>
      {done && <Tap className="btn" onClick={() => set({ startAt: Date.now() + 3000, hits: { shaurya: [], arushi: [] } })}>Play again</Tap>}
    </div>
  );
}

/* ---------- Wavelength & Telepathy Dial ---------- */
function Wave({ g, set }: { g: G; set: (d: G) => void }) {
  const { me } = useVelvet();
  const giver: Who = g.giver ?? g.by ?? me;
  const [clue, setClue] = useState('');
  const [guess, setGuess] = useState(50);
  const [l, r] = SPECTRA[g.s];
  const Dial = ({ v, show }: { v: number; show?: number }) => (
    <div style={{ position: 'relative', height: 40, borderRadius: 20, background: 'linear-gradient(90deg,#8FA8D9,#F5A3C7,#FF3E8A)' }}>
      {show !== undefined && <div style={{ position: 'absolute', left: `${show}%`, top: -6, bottom: -6, width: 6, marginLeft: -3, background: 'var(--gold)', borderRadius: 3, boxShadow: '0 0 12px var(--gold)' }} />}
      <motion.div animate={{ left: `${v}%` }} transition={spring} style={{ position: 'absolute', top: 4, width: 32, height: 32, marginLeft: -16, borderRadius: '50%', background: '#fff' }} />
    </div>
  );
  const score = Math.max(0, 100 - Math.abs((g.guess ?? 0) - g.target) * 3);
  return (
    <div className="col">
      <h2>Wavelength Dial</h2>
      <div className="row small"><b className="grow">{l}</b><b>{r}</b></div>
      {g.phase === 'clue' && (giver === me ? (
        <div className="glass card col">
          <div className="small muted">Secret target (only you see it). Give a 1-word clue.</div>
          <Dial v={g.target} show={g.target} />
          <input className="field" maxLength={24} placeholder="One word…" value={clue} onChange={(e) => setClue(e.target.value)} />
          <Tap className="btn" disabled={!clue.trim()} onClick={() => set({ clue: clue.trim(), phase: 'guess' })}>Send clue</Tap>
        </div>
      ) : <div className="glass card center muted">{PEOPLE[giver].name} is thinking of a clue…</div>)}
      {g.phase === 'guess' && (giver !== me ? (
        <div className="glass card col">
          <div className="center">Clue: <h2>“{g.clue}”</h2></div>
          <Dial v={guess} />
          <input type="range" min={0} max={100} value={guess} onChange={(e) => setGuess(+e.target.value)} />
          <Tap className="btn" onClick={() => { set({ guess, phase: 'reveal' }); sfx('shimmer'); }}>Lock it in</Tap>
        </div>
      ) : <div className="glass card center muted">Clue “{g.clue}” sent. Waiting for the guess…</div>)}
      {g.phase === 'reveal' && (
        <div className="glass card col center">
          <Dial v={g.guess} show={g.target} />
          <h2>{score >= 85 ? 'Telepathic 💞' : score >= 55 ? 'So close!' : 'Different planets 🪐'} · {score}</h2>
          <Tap className="btn" onClick={() => set({ s: rnd(SPECTRA.length), target: 5 + rnd(90), phase: 'clue', giver: giver === 'shaurya' ? 'arushi' : 'shaurya', clue: '', guess: null })}>Next round (swap)</Tap>
        </div>
      )}
    </div>
  );
}

/* ---------- Tier 1: simultaneous blind flip ---------- */
function BlindPick({ g, set }: { g: G; set: (d: G, m?: boolean) => void }) {
  const { me, partner } = useVelvet();
  const q = LIKELY[g.i % LIKELY.length];
  const picks = g.picks ?? {};
  const reveal = picks[me] && picks[partner];
  return (
    <div className="col">
      <h2>Who’s More Likely</h2>
      <motion.div key={g.i} className="glass card center" style={{ minHeight: 140, display: 'grid', placeItems: 'center' }} initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={spring}>
        <h3>{q}</h3>
      </motion.div>
      <div className="grid2">
        {(['shaurya', 'arushi'] as Who[]).map((w) => <Tap key={w} className={'pill' + (picks[me] === w ? ' on' : '')} onClick={() => set({ picks: { [me]: w } })}>{PEOPLE[w].name}</Tap>)}
      </div>
      <AnimatePresence>
        {reveal ? (
          <motion.div className="grid2" initial={{ rotateX: 90 }} animate={{ rotateX: 0 }} transition={spring}>
            {[me, partner].map((w) => <div key={w} className="glass card center"><div className="small muted">{PEOPLE[w].name} says</div><h3>{PEOPLE[picks[w] as Who].name}</h3></div>)}
          </motion.div>
        ) : <div className="small muted center">{picks[me] ? `Waiting for ${PEOPLE[partner].name} to flip…` : 'Pick secretly — cards flip when you both choose.'}</div>}
      </AnimatePresence>
      {reveal && <div className="center">{picks[me] === picks[partner] ? '✨ Same answer!' : '😂 You disagree!'}</div>}
      <Tap className="btn ghost" onClick={() => set({ kind: 'likely', i: g.i + 1, at: Date.now() }, false)}>Next card</Tap>
    </div>
  );
}

/* ---------- blind text reveal (Finish / Guess / Deep) ---------- */
function BlindText({ g, set, deck, title, hint }: { g: G; set: (d: G, m?: boolean) => void; deck: string[]; title: string; hint?: string }) {
  const { me, partner } = useVelvet();
  const [txt, setTxt] = useState('');
  const ans = g.ans ?? {};
  const reveal = ans[me] && ans[partner];
  return (
    <div className="col">
      <h2>{title}</h2>
      {hint && <div className="small muted">{hint}</div>}
      <motion.div key={g.i} className="glass card" initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={spring}><h3>{deck[g.i % deck.length]}</h3></motion.div>
      {!ans[me] ? (
        <>
          <textarea className="field" rows={3} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Your answer (hidden until both submit)" />
          <Tap className="btn" disabled={!txt.trim()} onClick={() => { set({ ans: { [me]: txt.trim() } }); setTxt(''); sfx('pop'); }}>Lock my answer</Tap>
        </>
      ) : !reveal && <div className="glass card center muted">Locked 🔒 Waiting for {PEOPLE[partner].name}…</div>}
      {reveal && [me, partner].map((w, i) => (
        <motion.div key={w} className="glass card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.2 }}>
          <div className="small muted">{PEOPLE[w].name}</div><div>{ans[w]}</div>
        </motion.div>
      ))}
      <Tap className="btn ghost" onClick={() => set({ kind: g.kind, i: g.i + 1, at: Date.now() }, false)}>Next card</Tap>
    </div>
  );
}

/* ---------- Tier 2: Court of Love + live teases ---------- */
function Court({ g, set }: { g: G; set: (d: G, m?: boolean) => void }) {
  const { me, partner, send, toast } = useVelvet();
  const judge: Who = g.judge ?? g.by ?? me, accused: Who = judge === 'shaurya' ? 'arushi' : 'shaurya';
  return (
    <div className="col">
      <h2>⚖️ Court of Love</h2>
      <div className="glass card col center">
        <div className="small muted">The People vs. {PEOPLE[accused].name}</div>
        <h3>Charge: {CRIMES[g.crime % CRIMES.length]}</h3>
        {g.plea && <div className="tag">Plea: {g.plea}</div>}
        {g.verdict && <h2 style={{ color: 'var(--gold)' }}>{g.verdict}</h2>}
      </div>
      {me === accused && !g.verdict && (
        <div className="col">
          <Tap className="btn ghost" onClick={() => { set({ plea: 'Guilty of being adorable' }); send('reply', 'pleads: guilty of being adorable 🥺'); }}>Plead adorable 🥺</Tap>
          <Tap className="btn ghost" onClick={() => { set({ plea: 'Voice apology on the way' }); toast('Record your apology in Checkup → Hold to record'); }}>Offer a voice apology 🎙️</Tap>
          <Tap className="btn ghost" onClick={() => { const c = COUPONS[rnd(COUPONS.length)]; set({ plea: `Bribe: ${c}` }); send('coupon', c, { bribe: true }); }}>Bribe the judge 🎟️</Tap>
        </div>
      )}
      {me === judge && !g.verdict && <div className="row wrap">{VERDICTS.map((v) => <Tap key={v} className="pill" onClick={() => { set({ verdict: v }); sfx('shimmer'); send('reply', `Verdict: ${v}`); }}>{v}</Tap>)}</div>}
      <Tap className="btn ghost" onClick={() => set({ kind: 'court', crime: rnd(CRIMES.length), judge: partner, at: Date.now() }, false)}>New case (swap judge)</Tap>
    </div>
  );
}

function Teases() {
  const { send, toast, partner } = useVelvet();
  const n = PEOPLE[partner].name;
  const t = (kind: string, label: string) => { send('tease', label, { kind }); sfx('pop'); toast('😈 Sent', `${n}'s screen: ${label}`); };
  return (
    <div className="col">
      <h2>😈 Live Screen Teases</h2>
      <div className="small muted">These happen on {n}'s phone right now (if the app is open).</div>
      <Tap className="glass card" onClick={() => t('flip', 'flipped your screen upside down for 8s')}><b>🙃 Flip their screen</b><div className="small muted">upside down for 8 seconds</div></Tap>
      <Tap className="glass card" onClick={() => t('kisses', 'covered your screen in kisses')}><b>💋 Kiss-bomb their screen</b><div className="small muted">they have to wipe them off with a thumb</div></Tap>
      <Tap className="glass card" onClick={() => t('runaway', 'sent a runaway "Say I Love You" button')}><b>🏃 Runaway “Say I Love You”</b><div className="small muted">the button dodges their thumb</div></Tap>
    </div>
  );
}

/* ---------- Tier 3: gold-foil scratch-off ---------- */
function Scratch() {
  const { send, toast } = useVelvet();
  const [i, setI] = useState(rnd(SCRATCH.length));
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current!, x = c.getContext('2d')!;
    c.width = c.offsetWidth; c.height = c.offsetHeight;
    const gr = x.createLinearGradient(0, 0, c.width, c.height);
    gr.addColorStop(0, '#b8875a'); gr.addColorStop(0.5, '#f7d8a8'); gr.addColorStop(1, '#a8744a');
    x.globalCompositeOperation = 'source-over'; x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = 'rgba(60,20,30,.6)'; x.font = '600 16px Manrope'; x.textAlign = 'center'; x.fillText('scratch me ✦', c.width / 2, c.height / 2 + 5);
  }, [i]);
  const scratch = (e: React.PointerEvent) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    const c = cv.current!, r = c.getBoundingClientRect(), x = c.getContext('2d')!;
    x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(e.clientX - r.left, e.clientY - r.top, 22, 0, 7); x.fill();
    if (Math.random() < 0.08) buzz([6]);
  };
  return (
    <div className="col">
      <h2>🪙 Gold-Foil Scratch Cards</h2>
      <div style={{ position: 'relative', height: 160 }}>
        <div className="glass card center" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><h3>{SCRATCH[i]}</h3></div>
        <canvas ref={cv} className="scratch" onPointerMove={scratch} onPointerDown={scratch} />
      </div>
      <div className="row">
        <Tap className="btn ghost grow" onClick={() => setI((i + 1) % SCRATCH.length)}>New card</Tap>
        <Tap className="btn grow" onClick={() => { send('reply', `🪙 Scratch card for you: ${SCRATCH[i]}`); toast('Sent ✦'); }}>Send it to them</Tap>
      </div>
    </div>
  );
}

/* ---------- Tier 4: Wishes & Confessions + Heartbeat Sync ---------- */
function Confess({ g, set }: { g: G; set: (d: G) => void }) {
  const { me, partner } = useVelvet();
  const [txt, setTxt] = useState('');
  const cur = g.curious ?? {}, ans = g.ans ?? {};
  const open = cur[me] && cur[partner];
  return (
    <div className="col">
      <h2>🗝️ Wishes & Confessions</h2>
      <div className="small muted">Unlocks only when you both tap “I’m Curious”. Then write one wish or confession — both reveal together.</div>
      {!open ? (
        <div className="glass card col center">
          <div className="row" style={{ justifyContent: 'center' }}>{[me, partner].map((w) => <span key={w} className={'tag' + (cur[w] ? ' hot' : '')}>{PEOPLE[w].name} {cur[w] ? '✓ curious' : '…'}</span>)}</div>
          {!cur[me] && <Tap className="btn" onClick={() => set({ curious: { [me]: true } })}>I’m Curious 👀</Tap>}
        </div>
      ) : !ans[me] ? (
        <>
          <textarea className="field" rows={3} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="A wish, a confession, a secret soft thing…" />
          <Tap className="btn" disabled={!txt.trim()} onClick={() => set({ ans: { [me]: txt.trim() } })}>Seal it</Tap>
        </>
      ) : null}
      {open && ans[me] && !ans[partner] && <div className="glass card center muted">Sealed 🔒 waiting for {PEOPLE[partner].name}…</div>}
      {ans[me] && ans[partner] && [me, partner].map((w) => <motion.div key={w} className="glass card" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}><div className="small muted">{PEOPLE[w].name}</div>{ans[w]}</motion.div>)}
    </div>
  );
}

function Heartbeat({ g, set }: { g: G; set: (d: G) => void }) {
  const { me, partner } = useVelvet();
  const [hold, setHold] = useState(false);
  const [beats, setBeats] = useState(0);
  const h = g.holding ?? {};
  const fresh = (t?: number) => !!t && Date.now() - t < 4000;
  const both = hold && fresh(h[partner]);
  useEffect(() => { if (!hold) return void set({ holding: { [me]: 0 } }); set({ holding: { [me]: Date.now() } }); const t = setInterval(() => set({ holding: { [me]: Date.now() } }), 2000); return () => clearInterval(t); }, [hold, me, set]);
  useEffect(() => { if (!both) return setBeats(0); const t = setInterval(() => { sfx('heartbeat'); buzz([70, 140, 90]); setBeats((b) => b + 1); }, 900); return () => clearInterval(t); }, [both]);
  const warm = Math.min(1, beats / 30);
  return (
    <div className="col center">
      <h2>💓 Heartbeat Sync</h2>
      <div className="small muted">Both hold your thumb on the circle at the same time.</div>
      <motion.div onPointerDown={() => setHold(true)} onPointerUp={() => setHold(false)} onPointerLeave={() => setHold(false)}
        animate={{ scale: both ? [1, 1.12, 1] : hold ? 1.04 : 1 }} transition={{ repeat: both ? Infinity : 0, duration: 0.9 }}
        style={{ touchAction: 'none', margin: '20px auto', width: 220, height: 220, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 64,
          background: `radial-gradient(circle, rgba(255,${120 - warm * 60},${170 - warm * 80},${0.5 + warm * 0.4}), rgba(43,15,31,.8))`, boxShadow: both ? `0 0 ${40 + warm * 60}px var(--blush)` : '0 0 20px rgba(255,62,138,.3)' }}>
        {both ? '💞' : hold ? '🤍' : '👆'}
      </motion.div>
      <div>{both ? `In sync · ${beats} beats together` : hold ? `Waiting for ${PEOPLE[partner].name}'s thumb…` : fresh(h[partner]) ? `${PEOPLE[partner].name} is holding — join!` : 'Hold to begin'}</div>
    </div>
  );
}
