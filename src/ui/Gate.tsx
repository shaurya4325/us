import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { PEOPLE } from '../config/people';
import { isOnline, useVelvet } from '../lib/velvet';
import { Ico } from './icons';
import { moodPhoto } from '../config/moodPhotos';
import { buzz, sfx } from '../lib/fx';
import { Tap, spring } from './shell';

/** shown whenever only one of you is in the app: the 3D world stays unmounted */
export function Gate() {
  const { me, partner, states, send, toast } = useVelvet();
  const [cool, setCool] = useState(0);
  useEffect(() => { if (cool <= 0) return; const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t); }, [cool]);
  const pic = (w: typeof me) => states[w].cutout ?? moodPhoto(w, states[w].mood);
  const pOn = isOnline(states[partner]);
  const summon = () => {
    send('summon'); sfx('flare'); buzz([40, 60, 40]); setCool(30);
    toast(`${PEOPLE[partner].name} has been summoned`, 'Their phone is buzzing with a gate chime');
  };
  const Person = ({ who, here }: { who: typeof me; here: boolean }) => {
    const src = pic(who);
    return (
      <div className={'person' + (here ? '' : ' away')} style={{ ['--tint' as any]: PEOPLE[who].aura }}>
        <div className="avatar">{src ? <img src={src} alt="" /> : <span>{PEOPLE[who].initial}</span>}</div>
        <b>{PEOPLE[who].name}{who === me ? ' (you)' : ''}</b>
        <span className="state"><i />{here ? 'Here now' : 'Not here yet'}</span>
      </div>
    );
  };
  return (
    <main className="gate">
      <motion.section className="gate-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <div className="pair-row">
          <Person who={me} here />
          <div className="link" aria-hidden="true"><span /><Ico name="heart" size={20} /><span /></div>
          <Person who={partner} here={pOn} />
        </div>
        <h1>{pOn ? 'Opening our world…' : `Waiting for ${PEOPLE[partner].name}`}</h1>
        <p>Our world opens when we're both here. The spaces above still work while you wait.</p>
        <button className="cta" disabled={cool > 0 || pOn} onClick={summon}>
          <Ico name="bell" />{cool > 0 ? `Summoned · ${cool}s` : `Summon ${PEOPLE[partner].name}`}
        </button>
      </motion.section>
    </main>
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
        <div className="cd-title">You're both here</div>
        <AnimatePresence mode="popLayout"><motion.div key={n} className="n" initial={{ scale: 1.35, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={spring}>{n || <Ico name="heart" size={64} />}</motion.div></AnimatePresence>
        <div className="cd-sub">Entering our world together</div>
      </div>
    </div>
  );
}
