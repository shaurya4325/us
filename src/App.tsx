import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { PEOPLE, type Who } from './config/people';
import { moodById } from './config/moodPhotos';
import { getDoc, roomIdFor, setDoc, ROOT, getStatus } from './lib/sync';
import { VelvetProvider, isOnline, useVelvet, type Session } from './lib/velvet';
import { MoodRail, Particles, PresenceStage, Settings, Tap, TeaseLayer, Toasts, spring } from './ui/shell';
import { Checkup } from './ui/rooms/Checkup';
import { Arcade } from './ui/rooms/Arcade';
import { Cuddle } from './ui/rooms/Cuddle';
import { Sunday } from './ui/rooms/Sunday';
import { Capsule } from './ui/rooms/Capsule';
import { Gate, Countdown } from './ui/Gate';
import { Studio, UpdateModal } from './ui/Studio';
import { music, unlockAudio } from './world/sound';
import { SOLO, startSoloBot } from './dev/soloBot';

const World = lazy(() => import('./ui/World').then((m) => ({ default: m.World })));

const DRAWERS = [
  { id: 'care', icon: '🩺', label: 'Us Checkup & Open Heart', C: Checkup },
  { id: 'arcade', icon: '🎮', label: 'The Velvet Arcade', C: Arcade },
  { id: 'cuddle', icon: '🧸', label: 'Cuddle Corner', C: Cuddle },
  { id: 'sunday', icon: '🕯️', label: 'Sunday Safe Space', C: Sunday },
  { id: 'capsule', icon: '💍', label: 'Until We Marry', C: Capsule },
];
const SKEY = 'us:session';
// The passcode is never stored in the app or the repo. It hashes to our room id; only that room exists in Firestore,
// so any other code finds nothing. Sessions from the old partner-code pairing (no v: 2) must enter the passcode.
const SESSION_V = 2;
const load = (): Session | null => { try { return JSON.parse(localStorage.getItem(SKEY) ?? 'null'); } catch { return null; } };
const deviceId = () => { let d = localStorage.getItem('us:device'); if (!d) { d = crypto.randomUUID(); localStorage.setItem('us:device', d); } return d; };

export default function App() {
  // ?as=arushi|shaurya lets two demo windows act as two phones
  const [s, setS] = useState<Session | null>(() => {
    const as = new URLSearchParams(location.search).get('as');
    let saved = load();
    if (saved && saved.v !== SESSION_V) saved = null;
    return as && saved ? { ...saved, who: as as Who } : saved;
  });
  useEffect(() => {
    const u = () => unlockAudio();
    window.addEventListener('pointerdown', u);
    return () => window.removeEventListener('pointerdown', u);
  }, []);
  return (
    <>
      <div className="rotate"><div className="col center"><div style={{ fontSize: 48 }}>📱↻</div><h2>Turn your phone sideways</h2><div className="muted">us!! is played in landscape.</div></div></div>
      {!s ? <Pairing onPaired={(x) => { localStorage.setItem(SKEY, JSON.stringify(x)); setS(x); }} /> : (
        <VelvetProvider s={s}>
          <Home onLeave={() => { setDoc(`${ROOT}/${s.roomId}`, { seats: { [s.who]: null } }); localStorage.removeItem(SKEY); setS(null); }} />
        </VelvetProvider>
      )}
    </>
  );
}

type Phase = 'gate' | 'countdown' | 'world';

function Home({ onLeave }: { onLeave: () => void }) {
  const { me, partner, states, tease, status, toast, base } = useVelvet();
  useEffect(() => (SOLO ? startSoloBot(base, partner) : undefined), [base, partner]);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [settings, setSettings] = useState(false), [studio, setStudio] = useState(false);
  const [phase, setPhase] = useState<Phase>('gate');
  const [startAt, setStartAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // STRICT both-online lock: the world mounts only while both phones are in the app
  const meOn = isOnline(states[me], now) || !document.hidden, pOn = isOnline(states[partner], now);
  const both = meOn && pOn;
  const lostAt = useRef(0);
  useEffect(() => {
    if (both) {
      lostAt.current = 0;
      if (phase === 'gate') {
        // both phones compute the same start moment from the two presence timestamps
        let at = Math.max(states[me].since ?? 0, states[partner].since ?? 0) + 3500;
        if (Date.now() > at + 1500) at = Date.now() + 3000;
        setStartAt(at); setPhase('countdown');
      }
      return;
    }
    if (phase === 'gate') return;
    // partner hid the app → leave at once; silent drop → short grace for flaky networks
    const hard = states[partner].online === false;
    if (!lostAt.current) lostAt.current = Date.now();
    if (hard || Date.now() - lostAt.current > 6000) {
      setPhase('gate');
      if (phase === 'world') toast(`🌙 ${PEOPLE[partner].name} left our world`, 'Everything is saved. The gate opens again when you are both here.');
    }
  }, [both, now, phase, states, me, partner, toast]);
  useEffect(() => { if (phase === 'gate') music('home'); }, [phase]);
  const bothRef = useRef(both); bothRef.current = both;
  const enterWorld = useCallback(() => setPhase(bothRef.current ? 'world' : 'gate'), []);

  const D = DRAWERS.find((d) => d.id === drawer);
  const pm = moodById(states[partner].mood);
  return (
    <motion.div className="app" animate={{ rotate: tease?.kind === 'flip' ? 180 : 0 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
      {phase !== 'world' && <Particles />}
      {phase === 'world' ? (
        <Suspense fallback={<div className="gate"><div className="brand" style={{ fontSize: 40 }}>us!!</div></div>}>
          <World openDrawer={setDrawer} />
        </Suspense>
      ) : <Gate />}
      {phase === 'countdown' && <Countdown at={startAt} onDone={enterWorld} />}
      {/* partner's mood tints the light */}
      <div className="tint" style={{ background: `radial-gradient(circle at 80% 20%, ${pm.tint}55, transparent 60%)` }} />
      <div className="hud dock glass">
        {DRAWERS.map((d) => <button key={d.id} className={drawer === d.id ? 'on' : ''} title={d.label} onClick={() => setDrawer(drawer === d.id ? null : d.id)}>{d.icon}</button>)}
        <button title="Settings" onClick={() => setSettings(true)}>⚙︎</button>
        {me === 'shaurya' && <button title="Creator Update Studio" onClick={() => setStudio(true)}>🛠️</button>}
      </div>
      {status === 'denied' && <div className="hud banner" style={{ left: '50%', transform: 'translateX(-50%)', bottom: 8 }}>Live sync is blocked by Firestore rules — deploy firestore.us.rules.</div>}
      <PresenceStage />
      <MoodRail />
      <AnimatePresence>
        {D && (
          <>
            <motion.div key="bg" className="drawer-bg" onClick={() => setDrawer(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div key="dr" className="glass drawer" initial={{ x: '-105%' }} animate={{ x: 0 }} exit={{ x: '-105%' }} transition={spring}>
              <div className="row" style={{ marginBottom: 10 }}>
                <div className="grow"><div className="small muted">{D.icon} {D.label}</div></div>
                <Tap className="pill" onClick={() => setDrawer(null)}>✕</Tap>
              </div>
              <D.C />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <Toasts />
      <TeaseLayer />
      <UpdateModal />
      {settings && <Settings onClose={() => setSettings(false)} onLeave={onLeave} />}
      {studio && <Studio onClose={() => setStudio(false)} />}
    </motion.div>
  );
}

function Pairing({ onPaired }: { onPaired: (s: Session) => void }) {
  const [code, setCode] = useState('');
  const [who, setWho] = useState<Who | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr('');
    try {
      const roomId = await roomIdFor(code), dev = deviceId(), path = `${ROOT}/${roomId}`;
      const room = await getDoc(path);
      // demo mode (no Firebase) has nothing to check against, so the first code creates the local world
      if (!room && getStatus() !== 'demo') { setCode(''); throw new Error('Wrong passcode. This world is only for us two.'); }
      const seats = room?.seats ?? {};
      if (seats[who!] && seats[who!] !== dev) {
        // the same name on another phone: allowed only if that phone has been away 10+ minutes (e.g. reinstalled app)
        const st = await getDoc(`${path}/state/${who}`);
        if (st?.lastSeen && Date.now() - st.lastSeen < 10 * 60_000) throw new Error(`${PEOPLE[who!].name} is already in on another phone right now.`);
      }
      const next = { ...seats, [who!]: dev };
      await setDoc(path, { seats: next, maxMembers: 2, createdAt: room?.createdAt ?? Date.now() });
      onPaired({ roomId, who: who!, deviceId: dev, v: SESSION_V });
    } catch (e: any) {
      const c = String(e?.code ?? '');
      setErr(c.includes('permission') || c.includes('unavailable') ? 'Could not reach our world. Check the internet and try again.' : e?.message || 'Could not open');
    }
    setBusy(false);
  };
  return (
    <div className="pair">
      <Particles />
      <motion.div className="glass card col" style={{ width: '100%', maxWidth: 420, padding: 22 }} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
        <div className="brand" style={{ fontSize: 40 }}>us!!</div>
        <div className="muted">A tiny world for exactly two people.</div>
        <input className="field" type="password" inputMode="numeric" autoComplete="off" placeholder="Our passcode" value={code} maxLength={8}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && who && code.length === 8 && go()} style={{ letterSpacing: '0.35em', fontWeight: 700, textAlign: 'center' }} />
        <div className="muted small">Who's holding this phone?</div>
        <div className="grid2">
          {(['arushi', 'shaurya'] as Who[]).map((w) => <Tap key={w} className={'pill' + (who === w ? ' on' : '')} onClick={() => setWho(w)}>{PEOPLE[w].name}</Tap>)}
        </div>
        {err && <div className="banner">{err}</div>}
        <Tap className="btn" disabled={busy || code.length !== 8 || !who} onClick={go}>{busy ? 'Opening…' : 'Enter us!! 💗'}</Tap>
        <div className="small muted center">{getStatus() === 'demo' ? 'Demo mode: no Firebase keys, data stays on this device.' : 'Two seats only, one phone each. The world opens when you are both here.'}</div>
      </motion.div>
    </div>
  );
}
