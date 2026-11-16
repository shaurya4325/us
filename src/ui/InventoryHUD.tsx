// "Our Shared Pouch": the Minecraft-style hotbar (bottom centre) with the ⋯ button that opens the inventory,
// a hold-to-open radial tool wheel, and the emote button on the left that fans out the couple actions.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ITEMS, TIERS, TOOLS, TOOL_ORDER, GIFTABLE, item, type ToolId } from '../world/catalog';
import { PLACEABLE } from '../world/decor';
import type { WorldDoc } from '../world/types';
import { PEOPLE, type Who } from '../config/people';
import { tierName } from '../data/craftingRegistry';
import { patch } from '../lib/sync';
import { sound } from '../world/sound';
import { buzz } from '../lib/fx';
import { spring } from './shell';

export const SLOTS = 7;
const key = (who: Who) => `us:hotbar:${who}`;
export function loadBar(who: Who): string[] {
  try { const a = JSON.parse(localStorage.getItem(key(who)) ?? 'null'); if (Array.isArray(a) && a.length === SLOTS) return a; } catch { /* */ }
  return Array(SLOTS).fill('');
}
export const saveBar = (who: Who, a: string[]) => { try { localStorage.setItem(key(who), JSON.stringify(a)); } catch { /* */ } };
const isTool = (id: string): id is ToolId => id in TOOLS;
/** an item/tool icon, tinted where an emoji is reused (sakura timber, azure heartwood …) */
export const Icon = ({ id, size }: { id: string; size?: number }) => {
  const d = isTool(id) ? { icon: TOOLS[id].icon, tint: undefined } : item(id);
  return <i className="ico" style={{ filter: d.tint, fontSize: size }}>{d.icon}</i>;
};
/** keep the hotbar in step with what you own: new tools drop into the first empty slot */
export function syncBar(bar: string[], w: WorldDoc) {
  const out = bar.map((id) => (!id ? '' : isTool(id) ? (w.tools?.[id] ? id : '') : id));
  for (const t of TOOL_ORDER) if (w.tools?.[t] && !out.includes(t)) { const i = out.indexOf(''); if (i >= 0) out[i] = t; }
  return out;
}

export function Hotbar({ bar, sel, w, onSelect, onOpen, onWheel }: { bar: string[]; sel: number; w: WorldDoc; onSelect: (i: number) => void; onOpen: () => void; onWheel: (x: number, y: number) => void }) {
  const press = useRef<{ t: any; fired: boolean } | null>(null);
  const start = (e: React.PointerEvent) => {
    const x = e.clientX, y = e.clientY;
    press.current = { fired: false, t: setTimeout(() => { if (press.current) { press.current.fired = true; buzz('medium'); onWheel(x, y); } }, 380) };
  };
  const end = (i: number) => { const p = press.current; press.current = null; if (!p) return; clearTimeout(p.t); if (!p.fired) onSelect(i); };
  return (
    <div className="hud hotbar" onPointerLeave={() => { if (press.current) { clearTimeout(press.current.t); press.current = null; } }}>
      {bar.map((id, i) => {
        const n = id && !isTool(id) ? w.inv?.[id] ?? 0 : 0, t = id && isTool(id) && TOOLS[id].tiered ? w.tiers?.[id] ?? 0 : -1;
        return (
          <button key={i} className={'slot' + (i === sel ? ' on' : '') + (id && !isTool(id) && n <= 0 ? ' empty' : '')} onPointerDown={start} onPointerUp={() => end(i)}>
            {id && <Icon id={id} />}
            {id && !isTool(id) && <b className="n">{n}</b>}
            {t >= 0 && <span className="tier" style={{ background: TIERS[t].css }} />}
            <small className="k">{i + 1}</small>
          </button>
        );
      })}
      <button className="slot dots" title="Inventory" onClick={() => { sound('open'); onOpen(); }}>⋯</button>
    </div>
  );
}

/** hold a hotbar slot: a spring-animated pie of every tool around your thumb */
export function ToolWheel({ at, w, onPick, onClose }: { at: { x: number; y: number }; w: WorldDoc; onPick: (id: string) => void; onClose: () => void }) {
  const tools = ['none', ...TOOL_ORDER.filter((t) => w.tools?.[t])];
  const [hi, setHi] = useState(-1), R = 86, cx = Math.min(innerWidth - 110, Math.max(110, at.x)), cy = Math.min(innerHeight - 110, Math.max(110, at.y - 60));
  const pick = (i: number) => { if (i >= 0) { onPick(tools[i]); sound('select'); } onClose(); };
  const near = (x: number, y: number) => {
    const dx = x - cx, dy = y - cy; if (Math.hypot(dx, dy) < 26) return -1;
    let a = Math.atan2(dy, dx) + Math.PI / 2; if (a < 0) a += Math.PI * 2;
    return Math.round((a / (Math.PI * 2)) * tools.length) % tools.length;
  };
  return (
    <div className="wheel-bg" onPointerMove={(e) => setHi(near(e.clientX, e.clientY))} onPointerUp={(e) => pick(near(e.clientX, e.clientY))} onClick={onClose}>
      <motion.div className="wheel" style={{ left: cx, top: cy }} initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 24 }}>
        {tools.map((t, i) => {
          const a = (i / tools.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <button key={t} className={'slot' + (hi === i ? ' on' : '')} style={{ left: Math.cos(a) * R, top: Math.sin(a) * R }} onClick={(e) => { e.stopPropagation(); pick(i); }}>
              {t === 'none' ? <i className="ico">✋</i> : <Icon id={t} />}
            </button>
          );
        })}
        <div className="wheel-c">{hi >= 0 ? (tools[hi] === 'none' ? 'Hands' : TOOLS[tools[hi] as ToolId].name) : 'Slide to pick'}</div>
      </motion.div>
    </div>
  );
}

type Tab = 'pouch' | 'tools' | 'gifts';
export function Inventory({ w, path, me, partner, bar, setBar, sel, onHold, onEat, onGift, close }: {
  w: WorldDoc; path: string; me: Who; partner: Who; bar: string[]; setBar: (b: string[]) => void; sel: number;
  onHold: (id: string) => void; onEat: (id: string) => void; onGift: (id: string) => void; close: () => void;
}) {
  const [tab, setTab] = useState<Tab>('pouch');
  const [pick, setPick] = useState<string | null>(null);
  const inv = w.inv ?? {};
  const items = useMemo(() => {
    const order = ['res', 'mat', 'gem', 'treat', 'plush', 'gift', 'decor'];
    return Object.keys(ITEMS).filter((k) => (inv[k] ?? 0) > 0).sort((a, b) => order.indexOf(item(a).cat) - order.indexOf(item(b).cat));
  }, [w.inv]); // eslint-disable-line
  const gifts = Object.entries(w.giftbox?.[me] ?? {}).filter(([, n]) => n > 0);
  const assign = (slot: number) => {
    if (!pick) return;
    const b = bar.map((x) => (x === pick ? '' : x)); b[slot] = pick; setBar(b); sound('select'); buzz('light');
  };
  const I = pick ? (isTool(pick) ? null : item(pick)) : null;
  return (
    <>
      <motion.div className="drawer-bg" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div className="glass panel inventory" initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30 }} transition={spring}>
        <div className="row inv-top">
          <h2 className="grow">🎒 Our Shared Pouch</h2>
          <span className="chip">💫 {inv.star ?? 0}</span>
          <button className="pill" onClick={() => { sound('close'); close(); }}>✕</button>
        </div>
        <div className="row tabs-row">
          {([['pouch', '🎒 Pouch'], ['tools', '🛠️ Tools'], ['gifts', `🎁 Gifts${gifts.length ? ` (${gifts.length})` : ''}`]] as [Tab, string][]).map(([t, l]) => (
            <button key={t} className={'pill' + (tab === t ? ' on' : '')} onClick={() => { setTab(t); sound('tick'); }}>{l}</button>
          ))}
        </div>
        {tab === 'pouch' && (
          <>
            <div className="small muted">Everything either of you gathers lands here, live on both phones. Tap an item, then a hotbar slot below to hold it.</div>
            <div className="slotgrid">
              {items.map((id) => (
                <button key={id} className={'slot' + (pick === id ? ' on' : '')} onClick={() => { setPick(pick === id ? null : id); sound('tick'); }} title={item(id).name}>
                  <Icon id={id} /><b className="n">{inv[id]}</b>
                </button>
              ))}
              {Array.from({ length: Math.max(0, 27 - items.length) }, (_, i) => <div key={'e' + i} className="slot empty" />)}
            </div>
          </>
        )}
        {tab === 'tools' && (
          <div className="grid2">
            {TOOL_ORDER.map((t) => {
              const have = !!w.tools?.[t], tier = w.tiers?.[t] ?? 0;
              return (
                <button key={t} className={'opt row' + (pick === t ? ' on' : '')} disabled={!have} onClick={() => setPick(pick === t ? null : t)} style={{ gap: 10 }}>
                  <span className="slot"><Icon id={t} /></span>
                  <span className="col" style={{ gap: 2, alignItems: 'flex-start' }}>
                    <b>{TOOLS[t].name}</b>
                    <span className="small muted">{have ? TOOLS[t].does : 'Not crafted yet'}</span>
                    {have && TOOLS[t].tiered && <span className="pips">{TIERS.map((T, i) => <i key={i} style={{ background: i <= tier ? T.css : '#241a26' }} />)} <small>{tierName(tier)}</small></span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {tab === 'gifts' && (
          <div className="col">
            <div className="small muted">Parcels {PEOPLE[partner].name} wrapped for you. Unwrap to put them in the pouch.</div>
            {!gifts.length && <div className="banner">No parcels yet. Maybe send one first 😉</div>}
            <div className="slotgrid">
              {gifts.map(([id, n]) => (
                <button key={id} className="slot gift" onClick={() => { patch(path, {}, { [`giftbox.${me}.${id}`]: -1, [`inv.${id}`]: 1 }); sound('gift'); }} title={`Unwrap ${item(id).name}`}>
                  <Icon id={id} /><b className="n">{n}</b>
                </button>
              ))}
            </div>
          </div>
        )}
        {pick && (
          <div className="inv-detail row">
            <span className="slot big"><Icon id={pick} /></span>
            <div className="col grow" style={{ gap: 2 }}>
              <b>{isTool(pick) ? TOOLS[pick].name : I!.name}</b>
              <span className="small muted">{isTool(pick) ? TOOLS[pick].does : I!.blurb ?? (PLACEABLE.has(pick) ? 'Hold it, then press the action button to place it' : 'A material for crafting')}</span>
            </div>
            <div className="row wrap" style={{ gap: 6, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => { onHold(pick); close(); }}>✋ Hold</button>
              {I?.cat === 'treat' && <button className="btn ghost" onClick={() => { onEat(pick); setPick(null); }}>😋 Eat</button>}
              {!isTool(pick) && GIFTABLE(pick) && <button className="btn ghost" onClick={() => { onGift(pick); setPick(null); }}>🎁 Gift to {PEOPLE[partner].name}</button>}
            </div>
          </div>
        )}
        <div className="small muted" style={{ marginTop: 6 }}>Hotbar {pick ? '· tap a slot to put it there' : ''}</div>
        <div className="row" style={{ gap: 4 }}>
          {bar.map((id, i) => (
            <button key={i} className={'slot' + (i === sel ? ' on' : '')} onClick={() => (pick ? assign(i) : null)} onDoubleClick={() => { const b = [...bar]; b[i] = ''; setBar(b); }}>
              {id && <Icon id={id} />}{id && !isTool(id) && <b className="n">{inv[id] ?? 0}</b>}
            </button>
          ))}
          {pick && <button className="pill" onClick={() => { setBar(bar.map((x) => (x === pick ? '' : x))); }}>Remove</button>}
        </div>
      </motion.div>
    </>
  );
}

const EMOTES: [string, string, string][] = [['kiss', '💋', 'Kiss'], ['hug', '🤗', 'Hug'], ['hands', '🤝', 'Hold hands'], ['dance', '💃', 'Dance'], ['pat', '🫳', 'Head pat'], ['whisper', '🤫', 'Whisper'], ['wave', '👋', 'Wave']];
/** the emote button (left side): tap to fan out the couple actions */
export function EmoteButton({ love, near, holding, partner, onAct }: { love: number; near: boolean; holding: boolean; partner: Who; onAct: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const t = setTimeout(() => setOpen(false), 9000); return () => clearTimeout(t); }, [open]);
  return (
    <>
      <motion.button className={'hud emote' + (open ? ' on' : '') + (near ? ' near' : '')} whileTap={{ scale: 0.88 }} onClick={() => { setOpen(!open); sound(open ? 'close' : 'open'); buzz('light'); }}
        style={{ ['--love' as any]: `${Math.round(love * 100)}%` }} aria-label="Emotes">
        <span>{near ? '💞' : '💗'}</span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="emote-bg" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <div className="hud emote-fan">
              {EMOTES.map(([k, ic, l], i) => {
                const col = i % 4, row = Math.floor(i / 4), tx = 72 + col * 62, ty = -36 + row * 62, ok = k === 'wave' || near;
                return (
                  <motion.button key={k} className={'emo' + (k === 'hands' && holding ? ' on' : '') + (ok ? '' : ' off')}
                    initial={{ x: 0, y: 0, scale: 0.2, opacity: 0 }} animate={{ x: tx, y: ty, scale: 1, opacity: 1 }} exit={{ x: 0, y: 0, scale: 0.2, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 460, damping: 22, delay: i * 0.025 }}
                    onClick={() => { if (!ok) { sound('miss'); return; } onAct(k); setOpen(false); }}>
                    <b>{ic}</b><small>{k === 'hands' && holding ? 'Let go' : l}</small>
                  </motion.button>
                );
              })}
              {!near && <motion.div className="emote-hint" style={{ left: 252, top: 32 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Walk closer to {PEOPLE[partner].name} 💗</motion.div>}
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
