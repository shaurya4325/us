import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MOODS, moodById, moodPhoto } from '../config/moodPhotos';
import { PEOPLE, type Who } from '../config/people';
import { isOnline, useVelvet, type PersonState } from '../lib/velvet';
import { buzz, isMuted, setMuted, sfx } from '../lib/fx';
import { makeCutout } from '../lib/media';

export const spring = { type: 'spring', stiffness: 420, damping: 22 } as const;
export const Tap = ({ children, className = '', onClick, disabled, style, title }: { children: ReactNode; className?: string; onClick?: () => void; disabled?: boolean; style?: React.CSSProperties; title?: string }) => (
  <motion.button className={className} style={style} title={title} disabled={disabled} whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.03 }} transition={spring}
    onClick={() => { sfx('tap'); buzz('light'); onClick?.(); }}>{children}</motion.button>
);

export function Avatar({ who, st, cut = false }: { who: Who; st: PersonState; cut?: boolean }) {
  const src = cut ? st.cutout ?? moodPhoto(who, st.mood) : moodPhoto(who, st.mood, st.cutout);
  if (!src) return <div className="mono">{PEOPLE[who].initial}</div>;
  return cut && !st.cutout ? <img src={src} style={{ width: 58, height: 58, borderRadius: '50%', objectFit: 'cover' }} /> : <img src={src} alt={PEOPLE[who].name} />;
}

/* floating rose petals + light bokeh */
export function Particles() {
  const bits = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ l: Math.random() * 100, s: 8 + Math.random() * 10, d: 9 + Math.random() * 10, dl: -Math.random() * 18, i })), []);
  return (
    <div className="petals">
      {[0, 1, 2, 3].map((i) => <div key={'b' + i} className="bokeh" style={{ left: `${15 + i * 22}%`, top: `${20 + (i % 2) * 40}%`, width: 90 + i * 30, height: 90 + i * 30, animationDelay: `${-i * 3}s` }} />)}
      {bits.map((b) => <div key={b.i} className="petal" style={{ left: `${b.l}%`, width: b.s, height: b.s, animationDuration: `${b.d}s`, animationDelay: `${b.dl}s` }} />)}
    </div>
  );
}

export function Toasts() {
  const { toasts } = useVelvet();
  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} className="glass toast" initial={{ y: -20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 40 }} transition={spring}>
            <b>{t.title}</b>{t.body && <div className="small muted">{t.body}</div>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* TOP-RIGHT live presence stage */
export function PresenceStage() {
  const { me, partner, states, send, toast, ripple } = useVelvet();
  const pOn = isOnline(states[partner]);
  const show: Who[] = pOn ? [me, partner] : [me];
  const together = show.length === 2;
  const poke = () => { send('poke'); sfx('pop'); buzz([25, 60, 25]); toast('👉 Poke sent', `${PEOPLE[partner].name} will feel it`); };
  return (
    <div className="stage" onClick={poke}>
      {together && (
        <>
          {[0, 1].map((i) => (
            <motion.div key={i} className="ring" style={{ left: 22 + i * 30, top: 14, width: 60, height: 60, borderColor: i ? 'rgba(242,197,155,.7)' : 'rgba(255,62,138,.7)' }}
              animate={{ rotate: i ? -360 : 360, scale: [1, 1.08, 1] }} transition={{ rotate: { repeat: Infinity, duration: 6, ease: 'linear' }, scale: { repeat: Infinity, duration: 0.9 } }} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <motion.span key={'h' + i} style={{ position: 'absolute', left: 50 + i * 8, bottom: 30, fontSize: 11 }} animate={{ y: [-0, -60], opacity: [0, 1, 0] }}
              transition={{ repeat: Infinity, duration: 2.4, delay: i * 0.6 }}>💗</motion.span>
          ))}
          <motion.div style={{ position: 'absolute', left: 40, top: 40, width: 50, height: 4, borderRadius: 4, background: 'linear-gradient(90deg,transparent,#fff,transparent)' }}
            animate={{ opacity: [0, 0.9, 0], scaleX: [0.3, 1.2, 0.3] }} transition={{ repeat: Infinity, duration: 1.8 }} />
        </>
      )}
      {show.map((w, i) => (
        <motion.div key={w} className="cut" style={{ right: together ? (i ? 0 : 56) : 20, ['--aura' as any]: PEOPLE[w].aura }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: [0, -4, 0], scale: together ? [1, 1.05, 1] : [1, 1.02, 1] }}
          transition={{ y: { repeat: Infinity, duration: 3.2, delay: i * 0.4 }, scale: { repeat: Infinity, duration: together ? 0.9 : 3.2 } }}>
          <Avatar who={w} st={states[w]} cut />
          <div className="dot" />
        </motion.div>
      ))}
      <div className="small" style={{ position: 'absolute', bottom: -14, right: 4, fontSize: 10, color: together ? 'var(--gold)' : 'var(--muted)' }}>
        {together ? '✦ Together Live' : `${PEOPLE[partner].name} offline`}
      </div>
      <AnimatePresence>
        {ripple > 0 && <motion.div key={ripple} className="ring" style={{ right: 10, top: 10, width: 70, height: 70, borderColor: 'var(--blush)' }} initial={{ scale: 0.3, opacity: 1 }} animate={{ scale: 6, opacity: 0 }} transition={{ duration: 1.2 }} />}
      </AnimatePresence>
    </div>
  );
}

/* RIGHT-SIDE dual mood bar: partner's live mood photo on top, my 1-tap selector below */
export function MoodRail() {
  const { me, partner, states, setMe, send } = useVelvet();
  const pm = moodById(states[partner].mood), mine = states[me].mood;
  const myMood = moodById(mine);
  return (
    <div className="rail">
      <div className="who">{PEOPLE[partner].name}</div>
      <div className="portrait" style={{ ['--tint' as any]: pm.tint }}>
        <AnimatePresence mode="popLayout">
          <motion.div key={(states[partner].mood ?? '') + (states[partner].cutout ? 'c' : '')} style={{ position: 'absolute', inset: 0 }} initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <Avatar who={partner} st={states[partner]} />
          </motion.div>
        </AnimatePresence>
        <div className={'fx ' + pm.fx} />
      </div>
      <div className="who" style={{ color: pm.tint }}>{pm.emoji} {pm.label.split(' ')[0]}</div>
      <hr />
      <div className="who">You · {myMood.emoji}</div>
      <div className="moods">
      {MOODS.map((m) => (
        <motion.button key={m.id} className={'moodbtn' + (mine === m.id ? ' on' : '')} title={m.label} whileTap={{ scale: 0.8, rotate: -8 }} transition={spring}
          onClick={() => { if (mine === m.id) return; setMe({ mood: m.id, moodAt: Date.now() }); send('mood', m.id); sfx(m.priority ? 'chime' : 'shimmer'); buzz('medium'); }}>
          {m.emoji}
        </motion.button>
      ))}
      </div>
    </div>
  );
}

/* partner's live screen teases */
export function TeaseLayer() {
  const { tease, clearTease, send } = useVelvet();
  const [wiped, setWiped] = useState<number[]>([]);
  const [pos, setPos] = useState({ x: 0, y: 0, n: 0 });
  const kisses = useMemo(() => Array.from({ length: 14 }, () => ({ x: 5 + Math.random() * 70, y: 10 + Math.random() * 75, r: -30 + Math.random() * 60 })), [tease]);
  useEffect(() => {
    if (!tease) return;
    const t = setTimeout(clearTease, tease.kind === 'flip' ? Math.max(0, tease.until - Date.now()) : 60_000);
    return () => clearTimeout(t);
  }, [tease, clearTease]);
  useEffect(() => { if (tease?.kind === 'kisses' && wiped.length >= kisses.length) { setWiped([]); clearTease(); } }, [wiped, kisses, tease, clearTease]);
  if (!tease || tease.kind === 'flip') return null;
  if (tease.kind === 'kisses') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onPointerMove={(e) => {
        const i = kisses.findIndex((k, j) => !wiped.includes(j) && Math.hypot(k.x * innerWidth / 100 + 22 - e.clientX, k.y * innerHeight / 100 + 22 - e.clientY) < 46);
        if (i >= 0) { setWiped((w) => [...w, i]); sfx('pop'); buzz('light'); }
      }}>
        <div className="glass card center" style={{ position: 'absolute', left: 16, right: 16, bottom: 120 }}>Wipe off all the kisses with your thumb 💋</div>
        {kisses.map((k, i) => !wiped.includes(i) && <motion.div key={i} className="kiss" style={{ left: `${k.x}%`, top: `${k.y}%`, rotate: k.r }} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>💋</motion.div>)}
      </div>
    );
  }
  // runaway "Say I Love You" button
  return (
    <div className="sheet-bg" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass card center col" style={{ width: '86%', height: 300, position: 'relative' }}>
        <h3>Say it. You know you want to.</h3>
        <motion.button className="btn" style={{ position: 'absolute', left: `calc(30% + ${pos.x}px)`, top: `calc(55% + ${pos.y}px)` }} animate={{ x: 0 }}
          onPointerEnter={() => pos.n < 4 && setPos({ x: (Math.random() - 0.5) * 160, y: (Math.random() - 0.5) * 160, n: pos.n + 1 })}
          onClick={() => { send('reply', 'I love you 💗 (caught the runaway button)'); sfx('shimmer'); setPos({ x: 0, y: 0, n: 0 }); clearTease(); }}>Say I Love You</motion.button>
      </div>
    </div>
  );
}

export function Settings({ onClose, onLeave }: { onClose: () => void; onLeave: () => void }) {
  const { me, states, setMe, toast, status } = useVelvet();
  const [busy, setBusy] = useState('');
  const [mute, setMute] = useState(isMuted());
  const pick = async (f?: File) => {
    if (!f) return;
    try { setBusy('Starting…'); const c = await makeCutout(f, setBusy); setMe({ cutout: c }); toast('✨ New cutout saved', 'Your partner sees it live'); }
    catch (e) { console.warn(e); toast('Cutout failed', 'Try a brighter photo with you in front'); }
    setBusy('');
  };
  return (
    <div className="sheet-bg" onClick={onClose}>
      <motion.div className="glass sheet col" onClick={(e) => e.stopPropagation()} initial={{ y: 400 }} animate={{ y: 0 }} transition={spring}>
        <h2>Settings</h2>
        <div className="row">
          <div className="portrait" style={{ width: 70, height: 90 }}><Avatar who={me} st={states[me]} /></div>
          <div className="col grow">
            <b>Your profile cutout</b>
            <span className="small muted">Background is removed right on your phone, fully offline and private.</span>
            <label className="btn ghost center">{busy || 'Upload photo'}<input type="file" accept="image/*" hidden disabled={!!busy} onChange={(e) => pick(e.target.files?.[0])} /></label>
          </div>
        </div>
        <Tap className="btn ghost" onClick={() => { setMuted(!mute); setMute(!mute); }}>{mute ? '🔇 Sounds off' : '🔊 Sounds on'}</Tap>
        <div className="small muted">Sync: {status === 'live' ? '🟢 live (Firebase)' : status === 'demo' ? '🟡 demo (this device only)' : '🔴 blocked by Firestore rules'}</div>
        <Tap className="btn ghost" onClick={onLeave}>Unpair this phone</Tap>
      </motion.div>
    </div>
  );
}
