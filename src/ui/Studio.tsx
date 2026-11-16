// Creator Update Studio (Shaurya, PIN-locked) + the "Shaurya pushed a new update" modal for Arushi.
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { CHEEKY, DEEP, FINISH, LIKELY, SCRATCH } from '../config/content';
import { PEOPLE } from '../config/people';
import { useShared, useVelvet } from '../lib/velvet';
import { sfx } from '../lib/fx';
import { Tap, spring } from './shell';

export const APP_BUILD = Number(import.meta.env.VITE_BUILD || 1);
export const APK_URL = import.meta.env.VITE_APK_URL || '';
const PIN = import.meta.env.VITE_STUDIO_PIN || '4325';
const DECKS = { likely: LIKELY, finish: FINISH, cheeky: CHEEKY, scratch: SCRATCH, deep: DEEP } as const;
type Deck = keyof typeof DECKS;
const DECK_LABEL: Record<Deck, string> = { likely: "Who's More Likely", finish: 'Finish My Sentence', cheeky: 'Guess My Answer', scratch: 'Scratch Cards', deep: 'Deep Questions' };

export interface Updates { version?: number; title?: string; notes?: string; build?: number; apk?: string; by?: string; cards?: Partial<Record<Deck, string[]>>; at?: number }

/** merges Shaurya's published cards into the live decks (keeps them sweet: plain text, short) */
export function useLiveContent() {
  const [u] = useShared<Updates>('updates');
  useEffect(() => {
    for (const k of Object.keys(DECKS) as Deck[]) for (const c of u?.cards?.[k] ?? []) if (c && !(DECKS[k] as string[]).includes(c)) (DECKS[k] as string[]).push(c.slice(0, 200));
  }, [u]);
  return u;
}

export function UpdateModal() {
  const { me } = useVelvet();
  const u = useLiveContent();
  const key = 'us:seenUpdate';
  const [seen, setSeen] = useState(() => Number(localStorage.getItem(key) || 0));
  if (!u?.version || u.version <= seen || u.by === me) return null;
  const needsApk = !!u.build && u.build > APP_BUILD && !!(u.apk || APK_URL);
  const apply = () => {
    localStorage.setItem(key, String(u.version)); setSeen(u.version!); sfx('shimmer');
    if (needsApk) location.href = u.apk || APK_URL; // opens the APK download in the system browser
  };
  return (
    <div className="sheet-bg" style={{ zIndex: 120 }}>
      <motion.div className="glass sheet col center modal-update" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
        <div style={{ fontSize: 40 }}>✨</div>
        <h2>{PEOPLE[(u.by as 'shaurya') ?? 'shaurya']?.name ?? 'Shaurya'} Pushed a New Update to us!!</h2>
        {u.title && <b>{u.title}</b>}
        {u.notes && <div className="muted small" style={{ whiteSpace: 'pre-wrap' }}>{u.notes}</div>}
        {u.cards && <div className="small">{Object.entries(u.cards).map(([k, v]) => `${v?.length ?? 0} new ${DECK_LABEL[k as Deck]}`).filter((x) => !x.startsWith('0')).join(' · ')}</div>}
        <Tap className="btn" onClick={apply}>{needsApk ? 'Download the new app ⬇' : 'Apply update 💗'}</Tap>
      </motion.div>
    </div>
  );
}

export function Studio({ onClose }: { onClose: () => void }) {
  const { me, send, toast } = useVelvet();
  const [u, setU] = useShared<Updates>('updates');
  const [ok, setOk] = useState(() => sessionStorage.getItem('us:studio') === '1');
  const [pin, setPin] = useState('');
  const [title, setTitle] = useState(''), [notes, setNotes] = useState('');
  const [deck, setDeck] = useState<Deck>('scratch'), [cards, setCards] = useState('');
  const [build, setBuild] = useState(String(Math.max(APP_BUILD, u?.build ?? 0)));
  const [apk, setApk] = useState(u?.apk || APK_URL);
  if (me !== 'shaurya') return null;
  const publish = () => {
    const extra = cards.split('\n').map((x) => x.trim()).filter(Boolean);
    const merged = { ...(u?.cards ?? {}) };
    if (extra.length) merged[deck] = [...(merged[deck] ?? []), ...extra];
    const b = Number(build) || APP_BUILD;
    setU({ version: Date.now(), title: title || 'Something new for you', notes, cards: merged, build: b, apk, by: me, at: Date.now() }, false);
    send('update', title || 'New surprises inside');
    sfx('shimmer'); toast('✨ Update published', 'Arushi will see it the next time she opens us!!');
    setTitle(''); setNotes(''); setCards('');
  };
  return (
    <div className="sheet-bg" onClick={onClose}>
      <motion.div className="glass sheet col" onClick={(e) => e.stopPropagation()} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
        <h2>🛠️ Creator Update Studio</h2>
        {!ok ? (
          <div className="row">
            <input className="field grow" type="password" inputMode="numeric" placeholder="Studio PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
            <Tap className="btn" onClick={() => { if (pin === PIN) { setOk(true); sessionStorage.setItem('us:studio', '1'); } else sfx('flare'); }}>Unlock</Tap>
          </div>
        ) : (
          <>
            <input className="field" placeholder="Update title (e.g. New scratch cards + pool room)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="field" rows={2} placeholder="What's new? (shows in her update modal)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="row wrap">{(Object.keys(DECKS) as Deck[]).map((d) => <Tap key={d} className={'pill' + (d === deck ? ' on' : '')} onClick={() => setDeck(d)}>{DECK_LABEL[d]}</Tap>)}</div>
            <textarea className="field" rows={3} placeholder={`New ${DECK_LABEL[deck]} cards — one per line`} value={cards} onChange={(e) => setCards(e.target.value)} />
            <div className="row">
              <input className="field" style={{ width: 110 }} inputMode="numeric" placeholder="APK build" value={build} onChange={(e) => setBuild(e.target.value)} />
              <input className="field grow" placeholder="APK download URL (GitHub release)" value={apk} onChange={(e) => setApk(e.target.value)} />
            </div>
            <div className="small muted">This phone runs build {APP_BUILD}. Raise the build number after you publish a new .apk release and she gets a one-tap download.</div>
            <Tap className="btn" onClick={publish}>Publish to Arushi ✨</Tap>
            {u?.version && <div className="small muted">Last published: {new Date(u.version).toLocaleString()} · {u.title}</div>}
          </>
        )}
      </motion.div>
    </div>
  );
}
