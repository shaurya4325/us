import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { SUNDAY_QS } from '../../config/content';
import { PEOPLE } from '../../config/people';
import { sfx } from '../../lib/fx';
import { useShared, useVelvet } from '../../lib/velvet';
import { Tap, spring } from '../shell';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** key of the most recent Sunday (today if Sunday) */
export const sundayKey = (d = new Date()) => ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()));

export function Sunday() {
  const { me, partner, send } = useVelvet();
  const isSunday = new Date().getDay() === 0;
  const key = sundayKey();
  const [doc, save] = useShared<{ ans?: Record<string, string[]> }>(`sunday-${key}`);
  const [, saveCapsule] = useShared<Record<string, any>>('capsule');
  const [a, setA] = useState<string[]>(['', '', '', '']);
  const ans = doc?.ans ?? {};
  const both = ans[me] && ans[partner];

  // when both have answered, archive the week into the time capsule
  useEffect(() => {
    if (both) saveCapsule({ [key]: { week: key, favourite: { [me]: ans[me][0], [partner]: ans[partner][0] }, weather: { [me]: ans[me][1], [partner]: ans[partner][1] }, wishes: { [me]: ans[me][3], [partner]: ans[partner][3] } } });
  }, [both]); // eslint-disable-line

  const next = new Date(); next.setDate(next.getDate() + ((7 - next.getDay()) % 7 || 7));
  return (
    <div className="col">
      <h2>Sunday Safe Space</h2>
      <div className="small muted">A weekly ritual. Answers stay hidden until you both submit.</div>
      {!ans[me] && !isSunday && (
        <div className="glass card center col">
          <div style={{ fontSize: 40 }}>🕯️</div>
          <b>Opens on Sunday</b>
          <span className="muted small">{next.toDateString()} — {Math.ceil((next.setHours(0, 0, 0, 0) - Date.now()) / 864e5)} day(s) to go</span>
        </div>
      )}
      {!ans[me] && isSunday && (
        <div className="glass card col">
          {SUNDAY_QS.map((q, i) => (
            <label key={q} className="col" style={{ gap: 6 }}>
              <b>{i + 1}. {q}</b>
              <textarea className="field" rows={2} value={a[i]} onChange={(e) => setA(a.map((x, j) => (j === i ? e.target.value : x)))} />
            </label>
          ))}
          <Tap className="btn" disabled={a.some((x) => !x.trim())} onClick={() => { save({ ans: { [me]: a.map((x) => x.trim()) } }); send('sunday'); sfx('chime'); }}>Seal my answers</Tap>
        </div>
      )}
      {ans[me] && !both && <div className="glass card center muted">Sealed 🔒 — waiting for {PEOPLE[partner].name}. Both reveal together.</div>}
      {both && SUNDAY_QS.map((q, i) => (
        <motion.div key={q} className="glass card col" style={{ gap: 6 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.15 }}>
          <b>{q}</b>
          {[me, partner].map((w) => <div key={w}><span className="tag">{PEOPLE[w].name}</span> {ans[w][i]}</div>)}
        </motion.div>
      ))}
    </div>
  );
}
