import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { PEOPLE } from '../../config/people';
import { sfx } from '../../lib/fx';
import { shrink } from '../../lib/media';
import { addTo, getDoc } from '../../lib/sync';
import { useShared, useVelvet } from '../../lib/velvet';
import { Tap, spring } from '../shell';

const TOGETHER_SINCE = new Date(2026, 7, 7);
type Item = { text: string; phase: 'before' | 'after'; by: string; at: number; done?: boolean; doneAt?: number; photo?: string };

function Photo({ id }: { id: string }) {
  const { base } = useVelvet();
  const [src, setSrc] = useState<string>();
  useEffect(() => { getDoc(`${base}/blobs/${id}`).then((d) => setSrc(d?.data)); }, [base, id]);
  return src ? <img src={src} style={{ width: '100%', borderRadius: 14, marginTop: 8 }} /> : null;
}

export function Capsule() {
  const { me, base, send, toast } = useVelvet();
  const [bucket, saveBucket] = useShared<Record<string, Item>>('bucket');
  const [capsule] = useShared<Record<string, any>>('capsule');
  const [txt, setTxt] = useState('');
  const [phase, setPhase] = useState<'before' | 'after'>('before');
  const days = Math.floor((Date.now() - TOGETHER_SINCE.getTime()) / 864e5);
  const items = Object.entries(bucket ?? {}).sort((a, b) => a[1].at - b[1].at);

  const complete = async (id: string, f?: File) => {
    let photo: string | undefined;
    if (f) photo = await addTo(`${base}/blobs`, { data: await shrink(f, 720, 0.78), at: Date.now() });
    saveBucket({ [id]: { done: true, doneAt: Date.now(), ...(photo ? { photo } : {}) } });
    send('bucket', items.find(([k]) => k === id)?.[1].text); sfx('shimmer'); toast('💍 Dream completed!', 'Added to your timeline');
  };

  const timeline = [
    ...Object.values(capsule ?? {}).map((w: any) => ({ at: new Date(w.week).getTime(), kind: 'week' as const, w })),
    ...items.filter(([, i]) => i.done).map(([id, i]) => ({ at: i.doneAt!, kind: 'dream' as const, id, i })),
  ].sort((a, b) => b.at - a.at);

  return (
    <div className="col">
      <h2>Until We Marry</h2>
      <div className="glass card center"><div className="small muted">together for</div><h1 style={{ fontSize: 44 }}>{days} days</h1><div className="small muted">since 7 August 2026</div></div>

      <div className="section-title"><h3>Before & After Marriage</h3></div>
      <div className="glass card col">
        <div className="row">{(['before', 'after'] as const).map((p) => <Tap key={p} className={'pill grow' + (phase === p ? ' on' : '')} onClick={() => setPhase(p)}>{p === 'before' ? 'Before marriage' : 'After marriage'}</Tap>)}</div>
        <div className="row">
          <input className="field grow" placeholder="A dream for us…" value={txt} onChange={(e) => setTxt(e.target.value)} />
          <Tap className="btn" disabled={!txt.trim()} onClick={() => { saveBucket({ [Date.now().toString(36)]: { text: txt.trim(), phase, by: me, at: Date.now() } }); setTxt(''); sfx('pop'); }}>Add</Tap>
        </div>
        {items.filter(([, i]) => i.phase === phase).map(([id, i]) => (
          <motion.div key={id} layout className="row" transition={spring} style={{ opacity: i.done ? 0.55 : 1 }}>
            <span className="grow" style={{ textDecoration: i.done ? 'line-through' : undefined }}>{i.done ? '💖' : '🤍'} {i.text}</span>
            {!i.done && <label className="pill small">Done + photo<input type="file" accept="image/*" hidden onChange={(e) => complete(id, e.target.files?.[0])} /></label>}
            {!i.done && <Tap className="pill small" onClick={() => complete(id)}>✓</Tap>}
          </motion.div>
        ))}
      </div>

      <div className="section-title"><h3>Our Timeline</h3></div>
      {timeline.length === 0 && <div className="muted small">Weekly highlights archive here every Sunday, and finished dreams become photo memory cards.</div>}
      <div className="capsule-line">
        {timeline.map((t) => (
          <motion.div key={t.kind + t.at} className="capsule-item glass card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={spring}>
            <div className="small muted">{new Date(t.at).toDateString()}</div>
            {t.kind === 'week' ? (
              <>
                <b>Week of {t.w.week}</b>
                {Object.entries(t.w.favourite ?? {}).map(([w, v]) => <div key={w} className="small"><span className="tag">{PEOPLE[w as 'arushi'].name}</span> {String(v)}</div>)}
              </>
            ) : (
              <><b>💍 {t.i.text}</b>{t.i.photo && <Photo id={t.i.photo} />}</>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
