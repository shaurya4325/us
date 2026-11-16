// Functional-block screens: Crafting Table (tabbed recipe grid with a 3×3 auto-filled crafting grid),
// Cloud-Stone Furnace, Starlight Anvil, Petal Loom, Kitchen Hearth; plus the Adventure Board (daily co-op quests
// + Love Star shop), the Keepsake Chest, the Velvet Paintbrush palette and Lore Memory Stones.
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BLOCKS, BLUEPRINT_FROM, LORE, RECIPES, SHOP, TABS, UPGRADE, dayKey, recipesFor, tierName, todaysQuests, type Recipe, type Station, type Tab } from '../data/craftingRegistry';
import { PAINTS, ROOMS, TIERS, TOOLS, TOOL_ORDER, canAfford, item, negate, together, type Cost, type RoomType, type ToolId } from '../world/catalog';
import type { WorldDoc } from '../world/types';
import { PEOPLE, type Who } from '../config/people';
import { patch } from '../lib/sync';
import { sound } from '../world/sound';
import { buzz } from '../lib/fx';
import { Icon } from './InventoryHUD';

export const recipeLabel = (r: Recipe) => {
  if (r.tool) return { name: TOOLS[r.tool].name, icon: r.tool, n: 1 };
  if (r.block) return { name: BLOCKS[r.block].name, icon: '', glyph: BLOCKS[r.block].icon, n: 1 };
  const [id, n] = Object.entries(r.out ?? {})[0] ?? ['', 1];
  return { name: item(id).name, icon: id, n: n ?? 1 };
};
const Glyph = ({ r }: { r: Recipe }) => { const L = recipeLabel(r); return L.icon ? <Icon id={L.icon} /> : <i className="ico">{L.glyph}</i>; };

/** apply a craft: pay, receive, engrave (if crafted together), count quests. Returns false if it couldn't be paid. */
export function applyCraft(path: string, w: WorldDoc, r: Recipe, me: Who, tog: boolean, extra: Record<string, number> = {}) {
  const cost = tog ? together(r.cost) : r.cost;
  if (!canAfford(w.inv, cost)) return false;
  const day = dayKey(), L = recipeLabel(r), f: Record<string, any> = {}, inc: Record<string, number> = { ...negate(cost), 'stats.craft': 1, ...extra };
  for (const [k, v] of Object.entries(r.out ?? {})) inc[`inv.${k}`] = (inc[`inv.${k}`] ?? 0) + (v ?? 0);
  if (r.tool) f[`tools.${r.tool}`] = true;
  if (r.block) f[`stations.${r.block}`] = Date.now();
  if (tog) { f[`engraved.e${Date.now().toString(36)}`] = { item: L.name, at: Date.now() }; inc[`quests.${day}.p.ct`] = 1; }
  if (r.station === 'hearth') { inc[`quests.${day}.p.cook`] = 1; const id = Object.keys(r.out ?? {})[0]; if (id) inc[`quests.${day}.p.cook:${id}`] = 1; inc['stats.cook'] = 1; }
  patch(path, f, inc);
  void me;
  return true;
}

function CraftGrid({ r, inv, tog }: { r: Recipe; inv: Record<string, number>; tog: boolean }) {
  const cost = Object.entries(tog ? together(r.cost) : r.cost), cells = Array.from({ length: 9 }, (_, i) => cost[[4, 1, 3, 5, 7, 0, 2, 6, 8].indexOf(i)] ?? null);
  const L = recipeLabel(r);
  return (
    <div className="row craftgrid">
      <div className="grid9">
        {cells.map((c, i) => (
          <div key={i} className={'slot' + (c && (inv[c[0]] ?? 0) < (c[1] ?? 0) ? ' short' : '')}>
            {c && <><Icon id={c[0]} /><b className="n">{c[1]}</b></>}
          </div>
        ))}
      </div>
      <div className="arrow">➜</div>
      <div className="slot big out"><Glyph r={r} />{L.n > 1 && <b className="n">{L.n}</b>}</div>
    </div>
  );
}

export function StationPanel({ station, w, path, me, partnerNear, partner, onTogether, onBuild, onCook, toast }: {
  station: Station; w: WorldDoc; path: string; me: Who; partnerNear: boolean; partner: Who;
  onTogether: (r: Recipe) => void; onBuild: (t?: RoomType) => void; onCook: (r: Recipe, tog: boolean) => void; toast: (a: string, b?: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('Tools');
  const list = station === 'table' ? recipesFor('table', tab) : station === 'anvil' ? [] : recipesFor(station);
  const [sel, setSel] = useState<Recipe | null>(list[0] ?? null);
  const [prog, setProg] = useState<number | null>(null);
  useEffect(() => { setSel(list[0] ?? null); }, [tab]); // eslint-disable-line
  const inv = w.inv ?? {};
  const B = BLOCKS[station];
  const done = (r: Recipe, tog: boolean) => {
    if (!applyCraft(path, w, r, me, tog)) { toast('Not enough materials', 'Gather a little more'); sound('miss'); return; }
    const L = recipeLabel(r);
    if (station === 'furnace') { sound('ding'); } else if (station === 'loom') { sound('squish'); sound('sparkle'); } else { sound('anvil'); sound('build', { delay: 0.15 }); }
    if (r.tool === 'hatchet' || r.tool === 'pickaxe' || r.block) sound('unlock', { delay: 0.3 });
    buzz('medium');
    toast(`${tog ? '💞 ' : ''}${L.name} ${r.block ? 'placed at the camp!' : 'crafted!'}`, tog ? `Crafted Together by Shaurya & Arushi ✨ (25% off)` : r.tool ? TOOLS[r.tool].does : r.block ? BLOCKS[r.block].blurb : 'In the shared pouch');
  };
  const craft = (r: Recipe, tog: boolean) => {
    if (tog) return onTogether(r);
    if (station === 'hearth') return onCook(r, false);
    if (station === 'furnace') {
      if (!canAfford(inv, r.cost)) { toast('Not enough materials'); sound('miss'); return; }
      sound('sizzle'); const t0 = performance.now(), secs = r.secs ?? 2.5;
      const tick = () => { const k = (performance.now() - t0) / (secs * 1000); if (k >= 1) { setProg(null); done(r, false); } else { setProg(k); requestAnimationFrame(tick); } };
      requestAnimationFrame(tick); return;
    }
    done(r, false);
  };
  const owned = (r: Recipe) => (r.tool && w.tools?.[r.tool]) || (r.block && w.stations?.[r.block]);
  if (station === 'anvil') return <Anvil w={w} path={path} toast={toast} />;
  return (
    <div className="col">
      <h2>{B.icon} {B.name}</h2>
      {station === 'table' && (
        <div className="row tabs-row">{TABS.map((t) => <button key={t} className={'pill' + (tab === t ? ' on' : '')} onClick={() => { setTab(t); sound('tick'); }}>{t}</button>)}</div>
      )}
      {station === 'table' && tab === 'Rooms' ? <RoomsTab w={w} onBuild={onBuild} /> : (
        <div className="row station-body">
          <div className="slotgrid recipes">
            {list.map((r) => (
              <button key={r.id} className={'slot' + (sel?.id === r.id ? ' on' : '') + (owned(r) ? ' have' : canAfford(inv, r.cost) ? ' ready' : '')} onClick={() => { setSel(r); sound('tick'); }} title={recipeLabel(r).name}>
                <Glyph r={r} />{owned(r) && <b className="n">✓</b>}
              </button>
            ))}
          </div>
          {sel && (
            <div className="col grow recipe">
              <b>{recipeLabel(sel).name}</b>
              <CraftGrid r={sel} inv={inv} tog={false} />
              {station === 'furnace' && <div className="furnace"><i style={{ width: `${(prog ?? 0) * 100}%` }} /><span>🔥 {prog !== null ? 'Smelting…' : `${sel.secs ?? 2.5}s · wood is the fuel`}</span></div>}
              <div className="row wrap" style={{ gap: 6 }}>
                <button className="btn" disabled={!!owned(sel) || prog !== null || !canAfford(inv, sel.cost)} onClick={() => craft(sel, false)}>{owned(sel) ? '✓ Already ours' : station === 'hearth' ? '🍳 Cook' : station === 'furnace' ? '🔥 Smelt' : '🔨 Craft'}</button>
                <button className={'btn ghost together' + (partnerNear ? ' live' : '')} disabled={!partnerNear || !!owned(sel) || !canAfford(inv, together(sel.cost))} onClick={() => craft(sel, true)}>
                  💞 Craft Together −25%
                </button>
              </div>
              <div className="small muted">{partnerNear ? `${PEOPLE[partner].name} is right here: craft together for 25% off, double speed and an engraving.` : `Stand at the ${B.name.toLowerCase()} with ${PEOPLE[partner].name} to craft together (−25%, engraved).`}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RoomsTab({ w, onBuild }: { w: WorldDoc; onBuild: (t?: RoomType) => void }) {
  const built = new Set(Object.values(w.rooms ?? {}).map((c) => c.type));
  return (
    <div className="col">
      <div className="small muted">Room blueprints snap onto the house. Rare ones come from Ancient Blueprint Scrolls in the ruins.</div>
      <div className="grid2">
        {(Object.keys(ROOMS) as RoomType[]).map((t) => {
          const src = BLUEPRINT_FROM[t], locked = !!src && !w.bp?.[t] && !w.unlocks?.[`bp:${t}`] && !built.has(t);
          return (
            <button key={t} className="opt" disabled={built.has(t) || locked || (!Object.keys(w.rooms ?? {}).length && t !== 'bedroom')} onClick={() => onBuild(t)}>
              <b>{ROOMS[t].icon} {ROOMS[t].name}</b>
              <div className="small muted">{built.has(t) ? '✓ Built' : locked ? `🔒 Scroll in the ${{ temple: 'Cloud-Temple', shrine: 'Sakura Shrine', treehouse: 'Azure Treehouse', bells: 'Wind-Bell Sanctuary' }[src!]}` : ROOMS[t].blurb}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Anvil({ w, path, toast }: { w: WorldDoc; path: string; toast: (a: string, b?: string) => void }) {
  const tools = TOOL_ORDER.filter((t) => TOOLS[t].tiered);
  const up = (t: ToolId) => {
    const cur = w.tiers?.[t] ?? 0, cost = UPGRADE[cur + 1];
    if (!cost || !canAfford(w.inv, cost)) { sound('miss'); return; }
    patch(path, { [`tiers.${t}`]: cur + 1 }, { ...negate(cost), 'stats.upgrade': 1 });
    [0, 0.28, 0.56].forEach((d) => sound('anvil', { delay: d })); sound('unlock', { delay: 0.9 }); buzz([30, 60, 30, 60, 60]);
    toast(`⚒️ ${TOOLS[t].name} → ${tierName(cur + 1)}!`, 'Faster swings, bigger hits and a sparkle trail');
  };
  return (
    <div className="col">
      <h2>⚒️ Starlight Anvil</h2>
      <div className="small muted">Wood → Cloudstone → Sakura-Azure → Rose-Gold → Starlight. Each tier swings faster, hits harder and unlocks tougher stone.</div>
      {tools.map((t) => {
        const have = !!w.tools?.[t], cur = w.tiers?.[t] ?? 0, cost = UPGRADE[cur + 1] as Cost | undefined;
        return (
          <div key={t} className="row anvil-row">
            <span className="slot"><Icon id={t} /></span>
            <div className="col grow" style={{ gap: 3 }}>
              <b>{TOOLS[t].name} · <span style={{ color: TIERS[cur].css }}>{tierName(cur)}</span></b>
              <span className="pips">{TIERS.map((T, i) => <i key={i} style={{ background: i <= cur ? T.css : '#241a26' }} />)}</span>
            </div>
            {cost ? <div className="row" style={{ gap: 4 }}>{Object.entries(cost).map(([k, v]) => <span key={k} className={'slot sm' + ((w.inv?.[k] ?? 0) < (v ?? 0) ? ' short' : '')}><Icon id={k} /><b className="n">{v}</b></span>)}</div> : <span className="tag">MAX</span>}
            <button className="btn" disabled={!have || !cost || !canAfford(w.inv, cost)} onClick={() => up(t)}>{have ? (cost ? 'Upgrade' : '✨') : 'Craft first'}</button>
          </div>
        );
      })}
    </div>
  );
}

/** the cooking mini-game (3 timing taps), used by the kitchen hearth */
export function Cooking({ r, onDone, close }: { r: Recipe; onDone: (stars: number) => void; close: () => void }) {
  const [round, setRound] = useState(0), [score, setScore] = useState(0), [pos, setPos] = useState(0);
  const zone = useMemo(() => ({ a: 15 + Math.random() * 55, w: 20 - round * 3 }), [round]);
  const t0 = useRef(performance.now()), L = recipeLabel(r);
  useEffect(() => {
    if (round >= 3) return;
    let raf = 0; t0.current = performance.now();
    const tick = (n: number) => { setPos(50 + 50 * Math.sin((n - t0.current) / (560 - round * 90))); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); sound('sizzle');
    return () => cancelAnimationFrame(raf);
  }, [round]);
  const hit = () => {
    const ok = pos >= zone.a && pos <= zone.a + zone.w;
    sound(ok ? 'ding' : 'miss'); buzz(ok ? 'medium' : [20, 30, 20]);
    const s = score + (ok ? 1 : 0); setScore(s);
    if (round === 2) onDone(Math.max(1, s));
    setRound(round + 1);
  };
  return (
    <div className="col center">
      <h2><Icon id={L.icon} /> {L.name}</h2>
      {round < 3 ? (
        <>
          <div className="muted">{['Prep the ingredients', 'Cook it just right', 'Plate it with love'][round]}</div>
          <div className="cookbar"><div className="zone" style={{ left: `${zone.a}%`, width: `${zone.w}%` }} /><div className="mark" style={{ left: `${pos}%` }} /></div>
          <button className="btn" onPointerDown={hit}>Now!</button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 54 }}><Icon id={L.icon} /></div>
          <b>{'⭐'.repeat(Math.max(1, score))}</b>
          <button className="btn" onClick={close}>Serve it 💗</button>
        </>
      )}
    </div>
  );
}

export function Quests({ w, path, me, toast }: { w: WorldDoc; path: string; me: Who; toast: (a: string, b?: string) => void }) {
  const day = dayKey(), qs = todaysQuests(day), st = w.quests?.[day] ?? {}, stars = w.inv?.star ?? 0;
  const claim = (id: string, n: number) => { patch(path, { [`quests.${day}.c.${id}`]: true }, { 'inv.star': n, 'stats.stars': n }); sound('coins'); sound('unlock', { delay: 0.2 }); toast(`💫 +${n} Love Stars`, 'Spend them on rare rooms, plushies and capes'); };
  const buy = (s: (typeof SHOP)[number]) => {
    if (stars < s.stars) { sound('miss'); return; }
    const f: Record<string, any> = { [`unlocks.${s.id}`]: true }, inc: Record<string, number> = { 'inv.star': -s.stars };
    if (s.id === 'plushStar') { delete f[`unlocks.${s.id}`]; inc['inv.plushStar'] = 1; }
    patch(path, f, inc); sound('unlock'); sound('sparkle', { delay: 0.2 }); toast(`${s.icon} ${s.name}`, s.blurb);
  };
  void me;
  return (
    <div className="col">
      <h2>📜 Today's Co-Op Quests</h2>
      <div className="small muted">Three shared quests a day (new ones at midnight). Rewards go to both of you.</div>
      {qs.map((q) => {
        const p = Math.min(q.goal, st.p?.[q.ev] ?? 0), doneQ = p >= q.goal, got = !!st.c?.[q.id];
        return (
          <div key={q.id} className="quest row">
            <span className="slot">{q.coop ? '💞' : '🌿'}</span>
            <div className="col grow" style={{ gap: 4 }}>
              <b>{q.text}</b>
              <div className="lovebar qbar"><i style={{ width: `${(p / q.goal) * 100}%` }} /></div>
              <span className="small muted">{p}/{q.goal}{q.coop ? ' · co-op' : ''}</span>
            </div>
            <button className="btn" disabled={!doneQ || got} onClick={() => claim(q.id, q.stars)}>{got ? '✓' : `💫 ${q.stars}`}</button>
          </div>
        );
      })}
      <h3 style={{ marginTop: 8 }}>💫 Love Star shop · you have {stars}</h3>
      <div className="grid2">
        {SHOP.map((s) => {
          const own = s.id !== 'plushStar' && !!w.unlocks?.[s.id];
          return (
            <button key={s.id} className="opt" disabled={own || stars < s.stars} onClick={() => buy(s)}>
              <b>{s.icon} {s.name}</b><div className="small muted">{own ? '✓ Unlocked' : `${s.blurb} · 💫${s.stars}`}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Keepsakes({ w, me, partner }: { w: WorldDoc; me: Who; partner: Who }) {
  const lore = Object.keys(w.lore ?? {}).map((k) => { const [s, i] = k.split(':'); return LORE[s]?.[Number(i)]; }).filter(Boolean);
  const eng = Object.values(w.engraved ?? {}).sort((a, b) => b.at - a.at);
  const sent = Object.entries(w.giftbox?.[partner] ?? {}), got = w.stats?.gift ?? 0;
  void me;
  return (
    <div className="col">
      <h2>🧰 Keepsake Chest</h2>
      <h3>✨ Crafted Together by Shaurya & Arushi</h3>
      {eng.length ? <div className="row wrap" style={{ gap: 6 }}>{eng.slice(0, 24).map((e, i) => <span key={i} className="chip">💞 {e.item}</span>)}</div> : <div className="small muted">Nothing yet. Stand at a station together and press Craft Together.</div>}
      <h3>🪨 Lore Memory Stones ({lore.length}/9)</h3>
      {lore.length ? lore.map((l, i) => <div key={i} className="glass card small"><b>{l!.title}</b><div className="muted">{l!.text}</div></div>) : <div className="small muted">Read the memory stones inside the unsealed ruins.</div>}
      <h3>🎁 Gift parcels</h3>
      <div className="small muted">{got} sent in total{sent.length ? ` · unopened at ${PEOPLE[partner].name}'s: ${sent.filter(([, n]) => n > 0).map(([k, n]) => `${item(k).icon}×${n}`).join(' ')}` : ''}</div>
    </div>
  );
}

export function Paint({ w, path, room, close }: { w: WorldDoc; path: string; room: string; close: () => void }) {
  const c = w.rooms?.[room], cur = w.paint?.[room] ?? {};
  if (!c) return null;
  const set = (k: 'wall' | 'floor', v: number) => { patch(path, { [`paint.${room}.${k}`]: v }); sound('squish'); sound('sparkle', { delay: 0.1 }); };
  return (
    <div className="col">
      <h2>🖌️ Paint the {ROOMS[c.type].name}</h2>
      {(['wall', 'floor'] as const).map((k) => (
        <div key={k} className="col" style={{ gap: 6 }}>
          <b>{k === 'wall' ? 'Walls' : 'Floor'}</b>
          <div className="row wrap" style={{ gap: 6 }}>
            {PAINTS.map((p) => <button key={p} className={'swatch' + ((cur[k] ?? ROOMS[c.type][k]) === p ? ' on' : '')} style={{ background: '#' + p.toString(16).padStart(6, '0') }} onClick={() => set(k, p)} />)}
          </div>
        </div>
      ))}
      <div className="row"><button className="btn ghost" onClick={() => { patch(path, { [`paint.${room}`]: {} }); }}>Reset</button><button className="btn" onClick={close}>Done</button></div>
    </div>
  );
}

export function Lore({ d, close }: { d: { title: string; text: string; where: string }; close: () => void }) {
  return (
    <div className="col center lore">
      <div className="small muted">🪨 Lore Memory Stone · {d.where}</div>
      <h2>{d.title}</h2>
      <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>{d.text}</motion.p>
      <button className="btn" onClick={close}>Keep it in the chest 💗</button>
    </div>
  );
}
export const ALL_RECIPES = RECIPES;
