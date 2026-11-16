import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { PEOPLE } from '../config/people';
import { useVelvet } from '../lib/velvet';
import { moodPhoto } from '../config/moodPhotos';
import { buzz, sfx } from '../lib/fx';
import { Tap, spring } from './shell';

/** shown whenever only one of you is in the app: the 3D world stays unmounted */
export function Gate() {
  const { me, partner, states, send, toast } = useVelvet();
  const [cool, setCool] = useState(0);
  useEffect(() => { if (cool <= 0) return; const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t); }, [cool]);
  const clouds = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ top: 6 + ((i * 37) % 80), w: 160 + ((i * 53) % 220), d: 34 + ((i * 11) % 30), dl: -i * 6 })), []);
  const mine = states[me].cutout ?? moodPhoto(me, states[me].mood);
  const summon = () => {
    send('summon'); sfx('flare'); buzz([40, 60, 40]); setCool(30);
    toast(`💗 ${PEOPLE[partner].name} has been summoned`, 'Their phone is buzzing with a gate chime');
  };
  return (
    <div className="gate">
      {clouds.map((c, i) => <div key={i} className="cloud" style={{ top: `${c.top}%`, width: c.w, height: c.w * 0.42, animationDuration: `${c.d}s`, animationDelay: `${c.dl}s` }} />)}
      <div className="col center" style={{ zIndex: 2, gap: 8, paddingRight: 'var(--rail)' }}>
        <div className="brand" style={{ fontSize: 34 }}>us!!</div>
        <div className="gate-c">
          <div className="col center" style={{ gap: 2 }}>
            <motion.div className="seat" style={{ ['--aura' as any]: PEOPLE[me].aura }} animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3.4 }}>
              {mine ? <img src={mine} alt="" /> : <div className="mono">{PEOPLE[me].initial}</div>}
            </motion.div>
            <b>{PEOPLE[me].name}</b><span className="small" style={{ color: '#5CF2A8' }}>● Online</span>
          </div>
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} style={{ fontSize: 30 }}>💞</motion.div>
          <div className="col center" style={{ gap: 2 }}>
            <div className="seat"><div className="ghost" /></div>
            <b>{PEOPLE[partner].name}</b><span className="small muted">Offline — Waiting to Enter Together</span>
          </div>
        </div>
        <div className="muted small" style={{ maxWidth: 460 }}>Our world only opens when we are both here. The drawers on the left still work — send love while you wait.</div>
        <Tap className="btn" disabled={cool > 0} onClick={summon}>{cool > 0 ? `Summoned 💗 (${cool}s)` : `Summon ${PEOPLE[partner].name} to Play`}</Tap>
      </div>
    </div>
  );
}

/** synchronized countdown + clouds parting, then the world mounts on both phones */
export function Countdown({ at, onDone }: { at: number; onDone: () => void }) {
  const [n, setN] = useState(Math.max(0, Math.ceil((at - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => {
      const left = at - Date.now();
      setN(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0) { clearInterval(t); onDone(); }
    }, 100);
    return () => clearInterval(t);
  }, [at, onDone]);
  useEffect(() => { if (n > 0) { sfx('heartbeat'); buzz([30]); } }, [n]);
  return (
    <div className="countdown">
      <motion.div className="part" style={{ left: 0 }} initial={{ x: 0 }} animate={{ x: n <= 1 ? '-70vw' : 0 }} transition={{ duration: 1.1, ease: 'easeInOut' }} />
      <motion.div className="part" style={{ right: 0 }} initial={{ x: 0 }} animate={{ x: n <= 1 ? '70vw' : 0 }} transition={{ duration: 1.1, ease: 'easeInOut' }} />
      <div className="col center" style={{ zIndex: 92 }}>
        <div className="brand" style={{ fontSize: 28 }}>You're both here</div>
        <AnimatePresence mode="popLayout"><motion.div key={n} className="n" initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={spring}>{n || '💞'}</motion.div></AnimatePresence>
        <div className="muted">Entering our world together…</div>
      </div>
    </div>
  );
}
