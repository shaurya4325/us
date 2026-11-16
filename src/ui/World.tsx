import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Engine, type HudState } from '../world/engine';
import { DISHES, PETS, RES_ICON, ROOMS, SIDES, TOOLS, WHISPERS, canAfford, costText, negate, type PetId, type Res, type RoomCell, type RoomType, type ToolId } from '../world/catalog';
import type { WorldDoc } from '../world/types';
import { patch } from '../lib/sync';
import { useShared, useVelvet } from '../lib/velvet';
import { PEOPLE, CAPES, type Who } from '../config/people';
import { MOOD_PHOTOS } from '../config/moodPhotos';
import { music, note, sound, type Track } from '../world/sound';
import { portrait } from '../world/portrait';
import { buzz } from '../lib/fx';
import { Tap, spring } from './shell';

export function World({ openDrawer }: { openDrawer: (id: string) => void }) {
  const { base, me, partner, toast, send, states } = useVelvet();
  const [world] = useShared<WorldDoc>('world');
  const worldPath = `${base}/shared/world`;
  const canvas = useRef<HTMLCanvasElement>(null), overlay = useRef<HTMLDivElement>(null), fade = useRef<HTMLDivElement>(null);
  const eng = useRef<Engine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [panel, setPanel] = useState<{ id: string; data?: any } | null>(null);
  const w = world ?? {};
  const wRef = useRef(w); wRef.current = w;

  useEffect(() => {
    const e = new Engine({
      canvas: canvas.current!, overlay: overlay.current!, fade: fade.current!, me, base, world: wRef.current,
      patch: (f, i) => patch(worldPath, f, i),
      onHud: setHud,
      onUi: (id, data) => {
        if (id === 'drawer') return openDrawer(data);
        if (id === 'event') return send('world', data.text);
        if (id === 'plush') { send('squeeze', data[0].toUpperCase() + data.slice(1)); toast(`🧸 Squeezed ${data[0].toUpperCase() + data.slice(1)}`, `${PEOPLE[partner].name} feels it`); return; }
        setPanel({ id, data });
      },
      toast, onCouple: (kind, from) => { if (from === me) patch(worldPath, {}, { [`stats.${kind}`]: 1 }); buzz(kind === 'kiss' ? [30, 50, 30] : 'medium'); },
    });
    eng.current = e;
    if (import.meta.env.DEV) Object.assign(window, { __us: e, __usPatch: (f: any, i: any) => patch(worldPath, f, i) });
    return () => { e.dispose(); eng.current = null; };
  }, [base, me]); // eslint-disable-line
  useEffect(() => { eng.current?.setWorld(w); }, [world]); // eslint-disable-line

  // soundtrack follows the scene
  useEffect(() => {
    if (!hud) return;
    const h = new Date().getHours();
    music(hud.scene === 'inside' ? 'rain' : h >= 17 || h < 6 ? 'sunset' : 'meadow');
  }, [hud?.scene]); // eslint-disable-line
  useEffect(() => () => music('sunset'), []);

  const inv = w.inv ?? {};
  const love = hud?.love ?? 0, full = love >= 0.99 && hud?.near;
  return (
    <>
      <div className="world"><canvas ref={canvas} /></div>
      <div className="overlay3d" ref={overlay} />
      <div className="fade" ref={fade} />
      {/* inventory */}
      <div className="hud inv">
        {(Object.keys(RES_ICON) as Res[]).map((r) => <span key={r} className="chip">{RES_ICON[r]} {inv[r] ?? 0}</span>)}
        {(Object.keys(TOOLS) as ToolId[]).filter((t) => w.tools?.[t]).map((t) => <span key={t} className="chip" title={TOOLS[t].name}>{TOOLS[t].icon}</span>)}
      </div>
      {/* love meter + couple actions */}
      <div className="hud love">
        <div className="row" style={{ gap: 6 }}>
          <span>{full ? '💞' : '🤍'}</span>
          <div className="lovebar"><i style={{ width: `${love * 100}%` }} /></div>
          <span className="small" style={{ fontWeight: 800, color: full ? 'var(--blush)' : 'var(--muted)' }}>{full ? 'Full Love' : 'Love'}</span>
        </div>
        <AnimatePresence>
          {full && (
            <motion.div className="couple" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
              {[['kiss', '💋 Kiss'], ['hug', '🤗 Hug'], ['hands', hud?.holding ? '🤝 Let go' : '🤝 Hold Hands'], ['dance', '💃 Dance'], ['pat', '🫳 Head Pat'], ['whisper', '🤫 Whisper']].map(([k, l]) => (
                <button key={k} className={k === 'hands' && hud?.holding ? 'on' : ''} onClick={() => { eng.current?.couple(k, k === 'whisper' ? WHISPERS[Math.floor(Math.random() * WHISPERS.length)] : ''); }}>{l}</button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        {hud && hud.partnerScene && hud.partnerScene !== hud.scene && <div className="where">{PEOPLE[partner].name} is {hud.partnerScene === 'inside' ? 'inside our house 🏡' : 'out in the meadow 🌿'}</div>}
        {hud?.synergy && <div className="where" style={{ color: 'var(--gold)' }}>✦ Partner Synergy Cable · 2× harvest</div>}
        {hud && <div className="debug">{hud.fps} fps · {hud.calls} draws · {hud.link === 'p2p' ? 'direct link' : 'cloud link'} · {hud.dpr}x</div>}
      </div>
      <Badge who="shaurya" side="left" energy={states.shaurya.energy} />
      <Badge who="arushi" side="right" energy={states.arushi.energy} />
      <Joystick onMove={(x, y) => eng.current?.setJoy(x, y)} />
      <div className="hud acts">
        <motion.button className="round jumpbtn" whileTap={{ scale: 0.85 }} onPointerDown={() => eng.current?.jump()}>JUMP</motion.button>
        <motion.button className={'round ctxbtn' + (hud?.ctx ? '' : ' off')} whileTap={{ scale: 0.88 }} onPointerDown={() => { eng.current?.interact(); buzz('light'); }}>
          <b>{hud?.ctx?.locked ?? hud?.ctx?.icon ?? '✋'}</b>{hud?.ctx?.label ?? 'Explore'}
        </motion.button>
      </div>
      <AnimatePresence>{panel && <Panel key={panel.id} p={panel} w={w} path={worldPath} close={() => setPanel(null)} eng={eng.current} me={me} />}</AnimatePresence>
    </>
  );
}

function Badge({ who, side, energy }: { who: Who; side: 'left' | 'right'; energy?: number }) {
  const src = useMemo(() => portrait(who), [who]);
  const e = Math.max(0.05, Math.min(1, (energy ?? 70) / 100)), C = 2 * Math.PI * 28;
  return (
    <div className="hud badge" style={side === 'left' ? { left: 'calc(env(safe-area-inset-left) + 14px)', top: '42%' } : { right: 'calc(var(--rail) + 12px)', top: '38%' }}>
      <div className="ring">
        {src && <img src={src} alt="" />}
        <svg width="62" height="62"><circle cx="31" cy="31" r="28" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" />
          <circle cx="31" cy="31" r="28" fill="none" stroke={PEOPLE[who].aura} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${C * e} ${C}`} /></svg>
      </div>
      <span>{PEOPLE[who].name} · {Math.round(e * 100)}%</span>
    </div>
  );
}

function Joystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null), [k, setK] = useState({ x: 0, y: 0 }), id = useRef<number | null>(null);
  const move = (e: React.PointerEvent) => {
    if (id.current !== e.pointerId) return;
    const r = base.current!.getBoundingClientRect(), R = r.width / 2;
    let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    const dz = m < 0.12 ? 0 : 1;
    setK({ x: x * R * 0.55, y: y * R * 0.55 }); onMove(x * dz, y * dz);
  };
  const end = () => { id.current = null; setK({ x: 0, y: 0 }); onMove(0, 0); };
  return (
    <div className="hud joy" ref={base} onPointerDown={(e) => { id.current = e.pointerId; base.current!.setPointerCapture(e.pointerId); move(e); }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div className="knob" style={{ transform: `translate(${k.x}px, ${k.y}px)` }} />
    </div>
  );
}

/* ------------------------- panels ------------------------- */
function Panel({ p, w, path, close, eng, me }: { p: { id: string; data?: any }; w: WorldDoc; path: string; close: () => void; eng: Engine | null; me: Who }) {
  const { send, toast } = useVelvet();
  const inv = w.inv ?? {};
  const body = (() => {
    switch (p.id) {
      case 'build': return <Build w={w} path={path} close={close} />;
      case 'craft': return (
        <div className="col">
          <h2>🔨 Crafting Bench</h2>
          <div className="grid2">
            {(Object.keys(TOOLS) as ToolId[]).map((t) => {
              const T = TOOLS[t], have = !!w.tools?.[t];
              return (
                <Tap key={t} className="opt" disabled={have || !canAfford(inv, T.cost)} onClick={() => { patch(path, { [`tools.${t}`]: true }, negate(T.cost)); sound('build'); toast(`${T.icon} ${T.name} crafted!`, T.does); }}>
                  <b>{T.icon} {T.name}</b><div className="small muted">{T.does}</div><div className="small">{have ? '✓ Crafted (shared)' : costText(T.cost)}</div>
                </Tap>
              );
            })}
          </div>
        </div>);
      case 'pets': return (
        <div className="col">
          <h2>🐾 Pet Nest</h2>
          <div className="small muted">Adopted pets trot beside their owner, sniff out hidden crystals, and you can both pet them.</div>
          <div className="grid2">
            {(Object.keys(PETS) as PetId[]).map((id) => {
              const P = PETS[id], owner = w.pets?.[id]?.owner;
              return (
                <Tap key={id} className="opt" disabled={!!owner || !canAfford(inv, P.cost)} onClick={() => { patch(path, { [`pets.${id}`]: { owner: me, at: Date.now() } }, negate(P.cost)); send('adopt', `${P.icon} ${P.name}`); sound('shimmer'); close(); }}>
                  <b>{P.icon} {P.name}</b><div className="small">{owner ? `Lives with ${PEOPLE[owner].name}` : costText(P.cost)}</div>
                </Tap>
              );
            })}
          </div>
        </div>);
      case 'cook': return <Cook path={path} close={close} />;
      case 'outfit': return (
        <div className="col">
          <h2>🪞 Wardrobe Mirror</h2>
          <div className="row wrap">
            {CAPES.map((c, i) => <Tap key={c} className="opt" style={{ width: 54, height: 54, background: '#' + c.toString(16).padStart(6, '0') }} onClick={() => { patch(path, { [`capes.${me}`]: i }); sound('shimmer'); }}>{' '}</Tap>)}
          </div>
          <div className="small muted">Your cape colour changes live on both phones.</div>
        </div>);
      case 'petcare': {
        const owned = Object.keys(w.pets ?? {}) as PetId[];
        return (
          <div className="col center">
            <h2>{p.data === 'bowls' ? '🦴 Treat time' : '🪮 Grooming station'}</h2>
            <div style={{ fontSize: 40 }}>{owned.length ? owned.map((id) => PETS[id].icon).join(' ') : '🥺'}</div>
            <Tap className="btn" disabled={!owned.length} onClick={() => { patch(path, {}, { [`stats.${p.data}`]: 1 }); sound('squeak'); toast(owned.length ? 'Happy pets! 💗' : 'Adopt a pet at the Pet Nest first'); close(); }}>{owned.length ? (p.data === 'bowls' ? 'Feed everyone' : 'Brush their fluff') : 'No pets yet'}</Tap>
          </div>);
      }
      case 'wish': return <Wish w={w} path={path} kind={p.data} close={close} />;
      case 'music': return (
        <div className="col">
          <h2>💿 Vinyl Player</h2>
          {([['meadow', 'Pastel Meadow Breeze'], ['sunset', 'Sunset Clouds'], ['rain', 'Cozy Fireplace Rain'], ['stars', 'Stargazing Lullaby']] as [Track, string][]).map(([t, l]) => <Tap key={t} className="opt" onClick={() => { music(t); close(); }}>♫ {l}</Tap>)}
        </div>);
      case 'piano': return <Piano />;
      case 'trophy': {
        const s = w.stats ?? {}, days = Math.floor((Date.now() - new Date('2026-08-07T00:00:00+05:30').getTime()) / 864e5);
        return (
          <div className="col">
            <h2>🏆 Our Milestones</h2>
            <div className="grid3">
              {[['💞', 'days together', days], ['🏡', 'rooms built', Object.keys(w.rooms ?? {}).length], ['💋', 'kisses', s.kiss ?? 0], ['🤗', 'hugs', s.hug ?? 0], ['💃', 'dances', s.dance ?? 0], ['🪵', 'wood gathered', s.wood ?? 0], ['🪨', 'stone mined', s.stone ?? 0], ['🐟', 'koi caught', s.fish ?? 0], ['🍳', 'dishes cooked', s.cook ?? 0]].map(([i, l, v]) => (
                <div key={l as string} className="glass card center"><div style={{ fontSize: 22 }}>{i}</div><b style={{ fontSize: 20 }}>{v}</b><div className="small muted">{l}</div></div>
              ))}
            </div>
          </div>);
      }
      default: return null;
    }
  })();
  if (p.id === 'stars') return <Stars close={close} path={path} />;
  if (p.id === 'movie') return <Movie close={close} />;
  void eng;
  return (
    <>
      <motion.div className="drawer-bg" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div className="glass panel" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={spring}>
        <button className="pill" style={{ float: 'right' }} onClick={close}>✕</button>
        {body}
      </motion.div>
    </>
  );
}

function Build({ w, path, close }: { w: WorldDoc; path: string; close: () => void }) {
  const { me, send, toast } = useVelvet();
  const rooms = Object.values(w.rooms ?? {}) as RoomCell[];
  const at = (gx: number, gz: number, lv: number) => rooms.find((c) => c.gx === gx && c.gz === gz && c.lv === lv);
  const slots = useMemo(() => {
    if (!rooms.length) return [{ gx: 0, gz: 0, lv: 0, label: 'Starter room on the House Plot' }];
    const out: { gx: number; gz: number; lv: number; label: string }[] = [];
    for (const c of rooms) for (const s of SIDES) {
      const [dx, dz, dl] = s.d, gx = c.gx + dx, z = c.gz + dz, lv = c.lv + dl;
      if (Math.abs(gx) > 1 || Math.abs(z) > 1 || lv > 1) continue;
      if (lv === 1 && !at(gx, z, 0)) continue;            // upper rooms need a room underneath
      if (at(gx, z, lv) || out.some((o) => o.gx === gx && o.gz === z && o.lv === lv)) continue;
      out.push({ gx, gz: z, lv, label: `${s.label} · ${s.id === 'up' ? 'above' : 'next to'} the ${ROOMS[c.type].name.replace(/^.*?(\w+)$/, '$1')}` });
    }
    return out;
  }, [w.rooms]); // eslint-disable-line
  const [slot, setSlot] = useState(0);
  const built = new Set(rooms.map((c) => c.type));
  const types = (Object.keys(ROOMS) as RoomType[]).filter((t) => (rooms.length ? t !== 'bedroom' : t === 'bedroom') && !built.has(t));
  const go = (t: RoomType) => {
    const s = slots[slot]; if (!s) return;
    const id = 'r' + Date.now().toString(36);
    patch(path, { [`rooms.${id}`]: { id, type: t, gx: s.gx, gz: s.gz, lv: s.lv, by: me, at: Date.now() } }, negate(ROOMS[t].cost));
    sound('build'); send('build', `${ROOMS[t].icon} ${ROOMS[t].name}`); toast(`${ROOMS[t].icon} ${ROOMS[t].name} built!`, rooms.length ? 'It is stitched into the house with a hallway — walk in through the front door.' : 'Your cottage has a glowing front door now ✨');
    close();
  };
  return (
    <div className="col">
      <h2>🏡 {rooms.length ? 'Expand our house' : 'Build our first room'}</h2>
      {rooms.length > 0 && (
        <>
          <div className="small muted">Where should the new room go?</div>
          <div className="row wrap">{slots.map((s, i) => <Tap key={i} className={'pill' + (i === slot ? ' on' : '')} onClick={() => setSlot(i)}>{s.label}</Tap>)}</div>
          {!slots.length && <div className="banner">The plot is full — every side is built!</div>}
        </>
      )}
      <div className="grid2">
        {types.map((t) => (
          <Tap key={t} className="opt" disabled={!slots.length || !canAfford(w.inv, ROOMS[t].cost)} onClick={() => go(t)}>
            <b>{ROOMS[t].icon} {ROOMS[t].name}</b><div className="small muted">{ROOMS[t].blurb}</div><div className="small">{costText(ROOMS[t].cost)}</div>
          </Tap>
        ))}
      </div>
      {!types.length && <div className="small muted">All ten rooms are built. You did it, together. 💞</div>}
    </div>
  );
}

function Cook({ path, close }: { path: string; close: () => void }) {
  const { send, partner, toast } = useVelvet();
  const [dish, setDish] = useState<(typeof DISHES)[number] | null>(null);
  const [round, setRound] = useState(0), [score, setScore] = useState(0), [pos, setPos] = useState(0);
  const zone = useMemo(() => ({ a: 15 + Math.random() * 55, w: 18 - round * 3 }), [round, dish]); // eslint-disable-line
  const t0 = useRef(performance.now());
  useEffect(() => {
    if (!dish || round >= 3) return;
    let raf = 0; t0.current = performance.now();
    const tick = (n: number) => { setPos(50 + 50 * Math.sin((n - t0.current) / (520 - round * 90))); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); sound('sizzle');
    return () => cancelAnimationFrame(raf);
  }, [dish, round]);
  const hit = () => {
    const ok = pos >= zone.a && pos <= zone.a + zone.w;
    sound(ok ? 'ding' : 'miss'); buzz(ok ? 'medium' : [20, 30, 20]);
    const s = score + (ok ? 1 : 0); setScore(s);
    if (round === 2) {
      patch(path, {}, { [`dishes.${dish!.name}`]: 1, 'stats.cook': 1 });
      send('cook', `${dish!.icon} ${dish!.name} (${'⭐'.repeat(Math.max(1, s))})`);
      toast(`${dish!.icon} ${dish!.name} is ready!`, `${'⭐'.repeat(Math.max(1, s))} — saved one for ${PEOPLE[partner].name}`);
    }
    setRound(round + 1);
  };
  if (!dish) return (
    <div className="col">
      <h2>🍳 Couple's Kitchen</h2>
      <div className="small muted">Pick a dish. Tap when the marker is in the green zone — three steps per recipe.</div>
      <div className="grid2">{DISHES.map((d) => <Tap key={d.id} className="opt" onClick={() => setDish(d)}><b style={{ fontSize: 20 }}>{d.icon} {d.name}</b></Tap>)}</div>
    </div>
  );
  return (
    <div className="col center">
      <h2>{dish.icon} {dish.name}</h2>
      {round < 3 ? (
        <>
          <div className="muted">{['Prep the ingredients', 'Cook it just right', 'Plate it with love'][round]}</div>
          <div className="cookbar"><div className="zone" style={{ left: `${zone.a}%`, width: `${zone.w}%` }} /><div className="mark" style={{ left: `${pos}%` }} /></div>
          <Tap className="btn" onClick={hit}>Now!</Tap>
        </>
      ) : (
        <>
          <div style={{ fontSize: 54 }}>{dish.icon}</div>
          <b>{'⭐'.repeat(Math.max(1, score))}</b>
          <Tap className="btn" onClick={close}>Serve it 💗</Tap>
        </>
      )}
    </div>
  );
}

function Wish({ w, path, kind, close }: { w: WorldDoc; path: string; kind: string; close: () => void }) {
  const { me, send } = useVelvet();
  const [t, setT] = useState('');
  const list = Object.entries(w.wishes ?? {}).sort((a, b) => b[1].at - a[1].at);
  return (
    <div className="col">
      <h2>{kind === 'jar' ? '🫙 Wish Jar' : '💍 Our Wishlist Wall'}</h2>
      <div className="row">
        <input className="field grow" value={t} maxLength={140} placeholder={kind === 'jar' ? 'I wish…' : 'Before & after we marry, we will…'} onChange={(e) => setT(e.target.value)} />
        <Tap className="btn" disabled={!t.trim()} onClick={() => { patch(path, { [`wishes.w${Date.now().toString(36)}`]: { text: t.trim(), by: me, at: Date.now() } }); send('world', `added a wish: ${t.trim()}`); sound('shimmer'); setT(''); }}>Add</Tap>
      </div>
      {list.map(([id, x]) => <div key={id} className="glass card small"><b>{PEOPLE[x.by].name}:</b> {x.text}</div>)}
      {!list.length && <div className="small muted">No wishes yet. Make the first one.</div>}
      <Tap className="btn ghost" onClick={close}>Close</Tap>
    </div>
  );
}

function Piano() {
  const keys = [60, 62, 64, 65, 67, 69, 71, 72];
  const song = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62];
  return (
    <div className="col center">
      <h2>🎹 Music Studio</h2>
      <div className="keys">{keys.map((k, i) => <button key={k} onPointerDown={() => note(k)}>{'CDEFGABC'[i]}</button>)}</div>
      <Tap className="btn ghost" onClick={() => song.forEach((n, i) => setTimeout(() => note(n, 0.5), i * 330))}>▶ Play our song</Tap>
    </div>
  );
}

function Stars({ close, path }: { close: () => void; path: string }) {
  const { me, send } = useVelvet();
  const stars = useMemo(() => Array.from({ length: 90 }, () => ({ x: Math.random() * 100, y: Math.random() * 100, s: 1 + Math.random() * 2.5, d: Math.random() * 2 })), []);
  // a little constellation: S ♥ A
  const con = [[18, 30], [12, 38], [18, 46], [24, 54], [18, 62], [44, 44], [50, 38], [56, 44], [50, 56], [44, 44], [76, 62], [82, 30], [88, 62], [79, 48], [85, 48]];
  const [wished, setWished] = useState(false);
  return (
    <motion.div className="night" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { if (!wished) { setWished(true); sound('shimmer'); patch(path, { [`wishes.s${Date.now().toString(36)}`]: { text: 'a shooting-star wish 🌠', by: me, at: Date.now() } }); send('world', 'made a wish on a shooting star 🌠'); } else close(); }}>
      {stars.map((s, i) => <div key={i} className="star" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s` }} />)}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: '10% 15%', width: '70%', height: '70%' }}>
        <motion.polyline points={con.slice(0, 5).map((p) => p.join(',')).join(' ')} fill="none" stroke="#ffd27a" strokeWidth="0.4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2 }} />
        <motion.polyline points={con.slice(5, 10).map((p) => p.join(',')).join(' ')} fill="none" stroke="#ff7db5" strokeWidth="0.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, delay: 1.5 }} />
        <motion.polyline points={con.slice(10, 13).map((p) => p.join(',')).join(' ')} fill="none" stroke="#ffd27a" strokeWidth="0.4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, delay: 3 }} />
        <motion.line x1="79" y1="48" x2="85" y2="48" stroke="#ffd27a" strokeWidth="0.4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 4.6 }} />
        {con.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.9" fill="#fff" />)}
      </svg>
      <div className="center" style={{ position: 'absolute', bottom: 24, left: 0, right: 0 }}>
        <h2>{wished ? 'Wish saved to our jar 🌠' : 'Tap anywhere to make a wish'}</h2>
        <div className="small muted">{wished ? 'Tap again to go back inside' : 'Look — the stars spell us'}</div>
      </div>
    </motion.div>
  );
}

function Movie({ close }: { close: () => void }) {
  const { send, states, partner } = useVelvet();
  const pics = useMemo(() => [...Object.values(MOOD_PHOTOS.arushi).flat(), ...Object.values(MOOD_PHOTOS.shaurya).flat(), states.shaurya.cutout, states.arushi.cutout].filter(Boolean) as string[], []); // eslint-disable-line
  const [i, setI] = useState(0);
  useEffect(() => { send('world', 'started a movie night in the Velvet Cinema 🎬'); const t = setInterval(() => setI((x) => x + 1), 3200); return () => clearInterval(t); }, []); // eslint-disable-line
  void partner;
  return (
    <motion.div className="movie" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <AnimatePresence mode="wait">
        {pics.length ? <motion.img key={i} src={pics[i % pics.length]} initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }} /> : <h2>🎬 Add photos to start the reel</h2>}
      </AnimatePresence>
      <div className="small muted" style={{ position: 'absolute', bottom: 16 }}>Our little film · tap to leave the cinema</div>
    </motion.div>
  );
}
