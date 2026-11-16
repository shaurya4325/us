import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Engine, type HudState } from '../world/engine';
import { PETS, ROOMS, SIDES, TOOLS, WHISPERS, canAfford, costText, negate, item, type PetId, type RoomCell, type RoomType } from '../world/catalog';
import type { WorldDoc } from '../world/types';
import type { Act } from '../world/net';
import { patch } from '../lib/sync';
import { useShared, useVelvet } from '../lib/velvet';
import { PEOPLE, CAPES, type Who } from '../config/people';
import { MOOD_PHOTOS } from '../config/moodPhotos';
import { music, note, sound } from '../world/sound';
import { ZONE_TRACKS } from '../audio/BiomeAudioManager';
import { BIOMES, type Zone } from '../data/biomes';
import { BLUEPRINT_FROM, RECIPES, type Recipe, type Station } from '../data/craftingRegistry';
import { portrait } from '../world/portrait';
import { buzz } from '../lib/fx';
import { Tap, spring } from './shell';
import { SOLO, setSoloEngine } from '../dev/soloBot';
import { EmoteButton, Hotbar, Inventory, ToolWheel, loadBar, saveBar, syncBar, Icon } from './InventoryHUD';
import { Cooking, Keepsakes, Lore, Paint, Quests, StationPanel, applyCraft, recipeLabel } from './Stations';

const DEBUG = new URLSearchParams(location.search).has('debug');
type PanelS = { id: string; data?: any };
interface CT { n: string; r: Recipe; mine: boolean; until: number; myTap: boolean; theirTap: boolean; result?: 'ok' | 'fail' }

export function World({ openDrawer }: { openDrawer: (id: string) => void }) {
  const { base, me, partner, toast, send, states, setMe } = useVelvet();
  const [world] = useShared<WorldDoc>('world');
  const worldPath = `${base}/shared/world`;
  const canvas = useRef<HTMLCanvasElement>(null), overlay = useRef<HTMLDivElement>(null), fade = useRef<HTMLDivElement>(null);
  const eng = useRef<Engine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [panel, setPanel] = useState<PanelS | null>(null);
  const [inv, setInv] = useState(false), [wheel, setWheel] = useState<{ x: number; y: number } | null>(null);
  const w = world ?? {};
  const wRef = useRef(w); wRef.current = w;
  const meRef = useRef(states[me]); meRef.current = states[me];

  /* ---------- hotbar ---------- */
  const [bar, setBarS] = useState(() => loadBar(me)), [sel, setSel] = useState(0);
  const barRef = useRef(bar); barRef.current = bar;
  const setBar = useCallback((b: string[]) => { setBarS(b); saveBar(me, b); }, [me]);
  useEffect(() => { const nb = syncBar(bar, w); if (JSON.stringify(nb) !== JSON.stringify(bar)) setBar(nb); }, [w.tools]); // eslint-disable-line
  const held = sel >= 0 ? bar[sel] || 'none' : 'none';
  useEffect(() => { eng.current?.setHeld(held); }, [held, hud === null]); // eslint-disable-line
  const choose = (i: number) => { setSel(i === sel ? -1 : i); sound('select', { vol: 0.7 }); buzz('light'); };
  const holdItem = (id: string) => {
    let i = bar.indexOf(id);
    if (i < 0) { i = sel >= 0 && !bar[sel] ? sel : bar.indexOf(''); if (i < 0) i = sel >= 0 ? sel : SLOTSLAST; const b = [...bar]; b[i] = id; setBar(b); }
    setSel(i); sound('select');
  };

  /* ---------- craft together (dual-tap rhythm) ---------- */
  const [ct, setCt] = useState<CT | null>(null);
  const ctRef = useRef(ct); ctRef.current = ct;
  const [cooking, setCooking] = useState<{ r: Recipe; tog: boolean } | null>(null);
  const startTogether = (r: Recipe) => {
    const n = Math.random().toString(36).slice(2, 8);
    eng.current?.sendAct('ct', { s: 'ask', n, r: r.id });
    setCt({ n, r, mine: true, until: Date.now() + 2800, myTap: false, theirTap: false }); sound('notify');
    if (SOLO) setTimeout(() => onPartnerAct({ k: 'ct', t: Date.now(), d: { s: 'tap', n } }), 900);
  };
  const onPartnerAct = useCallback((a: Act) => {
    if (a.k !== 'ct') return;
    const d = a.d ?? {}, cur = ctRef.current;
    if (d.s === 'ask') { const r = RECIPES.find((x) => x.id === d.r); if (r) { setCt({ n: d.n, r, mine: false, until: Date.now() + 2800, myTap: false, theirTap: false }); sound('notify'); buzz([30, 50, 30]); } }
    else if (cur && cur.n === d.n && d.s === 'tap') setCt({ ...cur, theirTap: true });
    else if (cur && cur.n === d.n && d.s === 'done') setCt({ ...cur, result: d.ok ? 'ok' : 'fail' });
  }, []);
  const tapHeart = () => {
    const c = ctRef.current; if (!c || c.myTap || c.result) return;
    eng.current?.sendAct('ct', { s: 'tap', n: c.n }); setCt({ ...c, myTap: true }); sound('kiss', { vol: 0.5 }); buzz('medium');
  };
  useEffect(() => {
    if (!ct) return;
    if (ct.result) { const t = setTimeout(() => setCt(null), 1500); return () => clearTimeout(t); }
    if (ct.mine && ct.myTap && ct.theirTap) {
      eng.current?.sendAct('ct', { s: 'done', n: ct.n, ok: true });
      setCt({ ...ct, result: 'ok' });
      if (ct.r.station === 'hearth') setCooking({ r: ct.r, tog: true });
      else if (applyCraft(worldPath, wRef.current, ct.r, me, true)) {
        sound('anvil'); sound('sparkle', { delay: 0.2 }); sound('unlock', { delay: 0.4 });
        toast(`💞 ${recipeLabel(ct.r).name} — crafted together!`, 'Engraved: “Crafted Together by Shaurya & Arushi ✨” (25% off)');
      } else toast('Not enough materials');
      return;
    }
    const t = setTimeout(() => {
      const c = ctRef.current; if (!c || c.n !== ct.n || c.result) return;
      if (c.mine) eng.current?.sendAct('ct', { s: 'done', n: c.n, ok: false });
      setCt({ ...c, result: 'fail' }); sound('miss');
    }, Math.max(0, ct.until - Date.now()));
    return () => clearTimeout(t);
  }, [ct]); // eslint-disable-line

  /* ---------- engine ---------- */
  const [nightUntil, setNightUntil] = useState(0), [vinyl, setVinyl] = useState<Zone | null>(null);
  useEffect(() => {
    let dead = false, e: Engine | null = null;
    Promise.race([document.fonts.load('700 50px "Pixelify Sans"'), new Promise((r) => setTimeout(r, 1500))]).then(() => {
      if (dead) return;
      e = new Engine({
        canvas: canvas.current!, overlay: overlay.current!, fade: fade.current!, me, base, world: wRef.current, solo: SOLO,
        patch: (f, i) => patch(worldPath, f, i),
        onHud: setHud,
        onUi: (id, data) => {
          if (id === 'drawer') return openDrawer(data);
          if (id === 'event') return send('world', data.text);
          if (id === 'plush') { send('squeeze', data[0].toUpperCase() + data.slice(1)); toast(`🧸 Squeezed ${data[0].toUpperCase() + data.slice(1)}`, `${PEOPLE[partner].name} feels it`); return; }
          if (id === 'energy') { const cur = meRef.current?.energy ?? 70; setMe({ energy: data >= 100 ? 100 : Math.min(100, cur + data) }); return; }
          if (id === 'night') { setNightUntil(Date.now() + data * 1000); return; }
          setPanel({ id, data }); if (id !== 'lore') sound('open');
        },
        onPartnerAct, onHeld: (h) => { const i = barRef.current.indexOf(h); setSel(i); },
        toast, onCouple: (kind, from) => { if (from === me) patch(worldPath, {}, { [`stats.${kind}`]: 1 }); buzz(kind === 'kiss' ? [30, 50, 30] : 'medium'); },
      });
      eng.current = e;
      e.setHeld(barRef.current[0] || 'none');
      if (import.meta.env.DEV) Object.assign(window, { __us: e, __usPatch: (f: any, i: any) => patch(worldPath, f, i) });
      if (SOLO) setSoloEngine(e);
    });
    return () => { dead = true; if (SOLO) setSoloEngine(null); e?.dispose(); eng.current = null; };
  }, [base, me]); // eslint-disable-line
  useEffect(() => { eng.current?.setWorld(w); }, [world]); // eslint-disable-line

  // keyboard: 1-7 hotbar, I inventory
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.target instanceof HTMLInputElement) return; const n = Number(e.key); if (n >= 1 && n <= 7) choose(n - 1); if (e.key.toLowerCase() === 'i') setInv((v) => !v); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  // soundtrack: biome → house → late night, with the vinyl player and stargazing as overrides
  const [nowT, setNowT] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNowT(Date.now()), 5000); return () => clearInterval(t); }, []);
  const hour = new Date(nowT).getHours(), late = hour >= 22 || hour < 5;
  const zone: Zone = nightUntil > nowT ? 'night' : vinyl ?? (hud?.scene === 'inside' ? (late ? 'night' : 'home') : (hud?.biome ?? 'prairie'));
  useEffect(() => { if (hud) music(zone); }, [zone, !!hud]); // eslint-disable-line
  useEffect(() => () => music('home'), []);

  // a soft Sky-style title whenever you enter a new biome
  const [banner, setBanner] = useState<{ id: string; k: number } | null>(null);
  const lastBiome = useRef<string | null>(null);
  useEffect(() => {
    const b = hud?.scene === 'over' ? hud.biome : null;
    if (b && b !== lastBiome.current) { lastBiome.current = b; setBanner({ id: b, k: Date.now() }); sound('chime', { vol: 0.7 }); }
    if (hud?.scene === 'inside') lastBiome.current = null;
  }, [hud?.biome, hud?.scene]);
  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner(null), 3600); return () => clearTimeout(t); }, [banner]);

  const love = hud?.love ?? 0;
  const close = () => { setPanel(null); sound('close'); };
  return (
    <>
      <div className="world"><canvas ref={canvas} /></div>
      <div className="overlay3d" ref={overlay} />
      <div className="fade" ref={fade} />
      {/* top centre: love meter + where your partner is */}
      <div className="hud love">
        <div className="row" style={{ gap: 6 }}>
          <span>{love >= 0.99 && hud?.near ? '💞' : '🤍'}</span>
          <div className="lovebar"><i style={{ width: `${love * 100}%` }} /></div>
        </div>
        {hud && hud.partnerScene && hud.partnerScene !== hud.scene && <div className="where">{PEOPLE[partner].name} is {hud.partnerScene === 'inside' ? 'inside our house 🏡' : 'out exploring 🌿'}</div>}
        {hud && hud.pBiome && hud.pBiome !== hud.biome && <div className="where">{PEOPLE[partner].name} · {BIOMES[hud.pBiome].name}</div>}
        {hud?.synergy && <div className="where" style={{ color: 'var(--gold)' }}>✦ Tether synergy · 2× harvest</div>}
        {!!hud?.buffs.length && <div className="row" style={{ gap: 4 }}>{hud.buffs.map((b, i) => <span key={i} className="chip">{{ speed: '🍡 +20% speed', hearts: '🥧 heart steps', energy: '☕', love: '🧋', cozy: '🥟' }[b.b]} · {b.left}s</span>)}</div>}
        {DEBUG && hud && <div className="debug">{hud.fps} fps · {hud.calls} draws · {Math.round(hud.tri / 1000)}k tris · {hud.link === 'p2p' ? 'direct' : 'cloud'} · {hud.dpr}x</div>}
      </div>
      <AnimatePresence>
        {banner && (
          <motion.div key={banner.k} className="biome-banner" initial={{ opacity: 0, y: -8, letterSpacing: '0.02em' }} animate={{ opacity: 1, y: 0, letterSpacing: '0.12em' }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 1.1, ease: 'easeOut' }}>
            <small>{BIOMES[banner.id as keyof typeof BIOMES].dir === 'home' ? 'home' : BIOMES[banner.id as keyof typeof BIOMES].dir}</small>
            <b>{BIOMES[banner.id as keyof typeof BIOMES].name}</b>
          </motion.div>
        )}
      </AnimatePresence>
      {hud?.pArrow != null && (
        <div className="compass" style={{ transform: `translate(-50%, -50%) rotate(${hud.pArrow}deg) translateX(min(34vw, 40vh))` }}>
          <span style={{ transform: `rotate(${-hud.pArrow}deg)` }}>{PEOPLE[partner].initial}<small>{hud.pDist}m</small></span>
        </div>
      )}
      {SOLO && !hud?.moment && (
        <div className="hud where solo-tag">
          🤖 Solo test · {PEOPLE[partner].name} is a bot
          <button className="pill" onClick={() => {
            patch(worldPath, { 'tools.hatchet': true, 'tools.pickaxe': true, 'tools.sickle': true, 'tools.can': true, 'tools.net': true, 'tools.rod': true, 'tools.hammer': true, 'tools.brush': true },
              Object.fromEntries(['wood', 'stone', 'crystal', 'flower', 'fish', 'bug', 'roseOre', 'sakuraWood', 'silk', 'pinkQuartz', 'nectar', 'azureWood', 'sap', 'moss', 'moonstone', 'shard', 'skyQuartz', 'cotton', 'clay', 'seaGlass', 'pearl', 'driftwood', 'sand', 'roseIngot', 'brick', 'sunGlass', 'gem', 'star', 'mochi', 'tart', 'cocoaRose', 'lantern', 'rug', 'plushMochi'].map((k) => [`inv.${k}`, ['gem', 'star'].includes(k) ? 30 : ['mochi', 'tart', 'cocoaRose', 'lantern', 'rug', 'plushMochi'].includes(k) ? 3 : 120])));
            toast('🎁 Test kit added', 'Every tool + plenty of every material');
          }}>🎁 Test kit</button>
        </div>
      )}
      <Badge who="shaurya" side="left" energy={states.shaurya.energy} />
      <Badge who="arushi" side="right" energy={states.arushi.energy} />
      <EmoteButton love={love} near={!!hud?.near} holding={!!hud?.holding} partner={partner} onAct={(k) => eng.current?.couple(k, k === 'whisper' ? WHISPERS[Math.floor(Math.random() * WHISPERS.length)] : '')} />
      <Joystick onMove={(x, y) => eng.current?.setJoy(x, y)} />
      <Hotbar bar={bar} sel={sel} w={w} onSelect={choose} onOpen={() => setInv(true)} onWheel={(x, y) => setWheel({ x, y })} />
      <div className="hud acts">
        <motion.button className="round jumpbtn" whileTap={{ scale: 0.85 }} onPointerDown={() => eng.current?.jump()}>JUMP</motion.button>
        <motion.button className={'round ctxbtn' + (hud?.ctx ? '' : ' off')} whileTap={{ scale: 0.88 }} onPointerDown={() => { eng.current?.interact(); buzz('light'); }}>
          <b style={{ filter: hud?.ctx?.tint }}>{hud?.ctx?.locked ?? hud?.ctx?.icon ?? '✋'}</b>{hud?.ctx?.label ?? 'Explore'}
        </motion.button>
      </div>
      {wheel && <ToolWheel at={wheel} w={w} onPick={(id) => holdItem(id === 'none' ? '' : id)} onClose={() => setWheel(null)} />}
      <AnimatePresence>
        {inv && <Inventory key="inv" w={w} path={worldPath} me={me} partner={partner} bar={bar} setBar={setBar} sel={sel} close={() => setInv(false)}
          onHold={holdItem} onEat={(id) => eng.current?.eat(id)} onGift={(id) => { if (!hud?.partnerScene || hud.partnerScene !== hud.scene) { toast(`Find ${PEOPLE[partner].name} first`, 'Gift parcels fly to them when you are in the same place'); return; } eng.current?.gift(id); }} />}
      </AnimatePresence>
      <AnimatePresence>{panel && <Panel key={panel.id + (panel.data ?? '')} p={panel} w={w} path={worldPath} close={close} me={me} partner={partner} near={!!hud?.near}
        onTogether={startTogether} onCook={(r, tog) => setCooking({ r, tog })} setPanel={setPanel} setVinyl={setVinyl} />}</AnimatePresence>
      <AnimatePresence>
        {cooking && (
          <>
            <motion.div className="drawer-bg" onClick={() => setCooking(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div className="glass panel" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={spring}>
              <Cooking r={cooking.r} close={() => setCooking(null)} onDone={(stars) => {
                const ok = applyCraft(worldPath, wRef.current, cooking.r, me, cooking.tog, stars >= 3 ? { [`inv.${Object.keys(cooking.r.out ?? {})[0]}`]: 1 } : {});
                if (!ok) { toast('Not enough ingredients'); return; }
                const L = recipeLabel(cooking.r);
                send('cook', `${item(L.icon).icon} ${L.name} (${'⭐'.repeat(stars)})`);
                toast(`${item(L.icon).icon} ${L.name} is ready!`, `${'⭐'.repeat(stars)}${stars >= 3 ? ' · perfect: one extra!' : ''}${cooking.tog ? ' · cooked together 💞' : ''}`);
              }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {ct && (
          <motion.div key={ct.n} className="ct" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div className="small">{ct.mine ? `Craft Together with ${PEOPLE[partner].name}` : `${PEOPLE[partner].name} wants to craft together`}</div>
            <b>{recipeLabel(ct.r).name}</b>
            {ct.result ? <h2>{ct.result === 'ok' ? '💞 In sync!' : '💔 Out of sync — try again'}</h2> : (
              <>
                <button className={'ct-heart' + (ct.myTap ? ' on' : '')} onPointerDown={tapHeart}>💗<i style={{ animationDuration: `${Math.max(0.3, (ct.until - Date.now()) / 1000)}s` }} /></button>
                <div className="small muted">Both tap the heart now! {ct.myTap ? '✓ you' : ''} {ct.theirTap ? `✓ ${PEOPLE[partner].name}` : ''}</div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
const SLOTSLAST = 6;

function Badge({ who, side, energy }: { who: Who; side: 'left' | 'right'; energy?: number }) {
  const src = useMemo(() => portrait(who), [who]);
  const e = Math.max(0.05, Math.min(1, (energy ?? 70) / 100)), C = 2 * Math.PI * 28;
  return (
    <div className={'hud badge ' + side}>
      <div className="ring" style={{ ['--e' as any]: `${Math.round(e * 100)}%` }}>
        {src && <img src={src} alt="" />}
        <svg width="62" height="62"><circle cx="31" cy="31" r="28" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" />
          <circle cx="31" cy="31" r="28" fill="none" stroke={PEOPLE[who].aura} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${C * e} ${C}`} /></svg>
      </div>
      <span>{PEOPLE[who].name} · {Math.round(e * 100)}%</span>
    </div>
  );
}

function Joystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null), knob = useRef<HTMLDivElement>(null), id = useRef<number | null>(null);
  // the knob moves via a direct style write (no React re-render per pointer move = smoother on phones)
  const set = (x: number, y: number) => { if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`; };
  const move = (e: React.PointerEvent) => {
    if (id.current !== e.pointerId) return;
    const r = base.current!.getBoundingClientRect(), R = r.width / 2;
    let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    const dz = m < 0.12 ? 0 : 1, curve = Math.min(1, (Math.min(m, 1) - 0.12) / 0.88);       // smooth ramp out of the dead zone
    set(x * R * 0.55, y * R * 0.55);
    const k = dz ? curve / Math.max(Math.min(m, 1), 1e-3) : 0;
    onMove(x * k, y * k);
  };
  const end = () => { id.current = null; set(0, 0); onMove(0, 0); };
  return (
    <div className="hud joy" ref={base} onPointerDown={(e) => { id.current = e.pointerId; base.current!.setPointerCapture(e.pointerId); move(e); }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div className="knob" ref={knob} />
    </div>
  );
}

/* ------------------------- panels ------------------------- */
function Panel({ p, w, path, close, me, partner, near, onTogether, onCook, setPanel, setVinyl }: {
  p: PanelS; w: WorldDoc; path: string; close: () => void; me: Who; partner: Who; near: boolean;
  onTogether: (r: Recipe) => void; onCook: (r: Recipe, tog: boolean) => void; setPanel: (p: PanelS | null) => void; setVinyl: (z: Zone | null) => void;
}) {
  const { send, toast } = useVelvet();
  const inv = w.inv ?? {};
  const body = (() => {
    switch (p.id) {
      case 'build': return <Build w={w} path={path} close={close} pre={p.data} />;
      case 'station': return <StationPanel station={p.data as Station} w={w} path={path} me={me} partner={partner} partnerNear={near} toast={toast}
        onTogether={(r) => { onTogether(r); }} onBuild={(t) => setPanel({ id: 'build', data: t })} onCook={(r, tog) => { close(); onCook(r, tog); }} />;
      case 'quests': return <Quests w={w} path={path} me={me} toast={toast} />;
      case 'keepsakes': return <Keepsakes w={w} me={me} partner={partner} />;
      case 'paint': return <Paint w={w} path={path} room={p.data} close={close} />;
      case 'lore': return <Lore d={p.data} close={close} />;
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
      case 'outfit': return (
        <div className="col">
          <h2>🪞 Wardrobe Mirror</h2>
          <div className="row wrap">
            {CAPES.map((c, i) => {
              const locked = i >= 6 && !w.unlocks?.[`cape${i}`];
              return <Tap key={c} className={'opt' + (w.capes?.[me] === i ? ' on' : '')} disabled={locked} style={{ width: 54, height: 54, background: '#' + c.toString(16).padStart(6, '0') }} onClick={() => { patch(path, { [`capes.${me}`]: i }); sound('shimmer'); }}>{locked ? '🔒' : ' '}</Tap>;
            })}
          </div>
          <div className="small muted">Your cape colour changes live on both phones. The last two come from the Love Star shop.</div>
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
          <Tap className="opt" onClick={() => { setVinyl(null); close(); }}>✨ Follow the biome (automatic)</Tap>
          {(Object.keys(ZONE_TRACKS) as Zone[]).map((z) => <Tap key={z} className="opt" onClick={() => { setVinyl(z); close(); }}>♫ {ZONE_TRACKS[z].title} <span className="small muted">· {z === 'home' ? 'cozy house' : z === 'night' ? 'late-night cuddles' : BIOMES[z as keyof typeof BIOMES].name}</span></Tap>)}
          <div className="small muted">Music by Kevin MacLeod (incompetech.com), CC BY 4.0</div>
        </div>);
      case 'piano': return <Piano />;
      case 'trophy': {
        const s = w.stats ?? {}, days = Math.floor((Date.now() - new Date('2026-08-07T00:00:00+05:30').getTime()) / 864e5);
        return (
          <div className="col">
            <h2>🏆 Our Milestones</h2>
            <div className="grid3">
              {[['💞', 'days together', days], ['🏡', 'rooms built', Object.keys(w.rooms ?? {}).length], ['💋', 'kisses', s.kiss ?? 0], ['🤗', 'hugs', s.hug ?? 0], ['💃', 'dances', s.dance ?? 0], ['🪵', 'wood gathered', (s.wood ?? 0) + (s.sakuraWood ?? 0) + (s.azureWood ?? 0)], ['🏛️', 'ruins unsealed', Object.keys(w.ruins ?? {}).length], ['🎁', 'gifts sent', s.gift ?? 0], ['🍳', 'treats cooked', s.cook ?? 0]].map(([i, l, v]) => (
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
  return (
    <>
      <motion.div className="drawer-bg" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div className={'glass panel' + (p.id === 'station' ? ' wide' : '')} initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={spring}>
        <button className="pill closex" onClick={close}>✕</button>
        {body}
      </motion.div>
    </>
  );
}

function Build({ w, path, close, pre }: { w: WorldDoc; path: string; close: () => void; pre?: RoomType }) {
  const { me, send, toast } = useVelvet();
  const rooms = Object.values(w.rooms ?? {}) as RoomCell[];
  const at = (gx: number, gz: number, lv: number) => rooms.find((c) => c.gx === gx && c.gz === gz && c.lv === lv);
  const slots = useMemo(() => {
    if (!rooms.length) return [{ gx: 0, gz: 0, lv: 0, label: 'Starter room on the House Plot' }];
    const out: { gx: number; gz: number; lv: number; label: string }[] = [];
    for (const c of rooms) for (const s of SIDES) {
      const [dx, dz, dl] = s.d, gx = c.gx + dx, z = c.gz + dz, lv = c.lv + dl;
      if (Math.abs(gx) > 1 || Math.abs(z) > 1 || lv > 1) continue;
      if (lv === 1 && !at(gx, z, 0)) continue;
      if (at(gx, z, lv) || out.some((o) => o.gx === gx && o.gz === z && o.lv === lv)) continue;
      out.push({ gx, gz: z, lv, label: `${s.label} · ${s.id === 'up' ? 'above' : 'next to'} the ${ROOMS[c.type].name.replace(/^.*?(\w+)$/, '$1')}` });
    }
    return out;
  }, [w.rooms]); // eslint-disable-line
  const [slot, setSlot] = useState(0);
  const built = new Set(rooms.map((c) => c.type));
  const locked = (t: RoomType) => !!BLUEPRINT_FROM[t] && !w.bp?.[t] && !w.unlocks?.[`bp:${t}`];
  const types = (Object.keys(ROOMS) as RoomType[]).filter((t) => (rooms.length ? t !== 'bedroom' : t === 'bedroom') && !built.has(t)).sort((a, b) => (a === pre ? -1 : b === pre ? 1 : Number(locked(a)) - Number(locked(b))));
  const go = (t: RoomType) => {
    const s = slots[slot]; if (!s) return;
    const id = 'r' + Date.now().toString(36);
    patch(path, { [`rooms.${id}`]: { id, type: t, gx: s.gx, gz: s.gz, lv: s.lv, by: me, at: Date.now() } }, negate(ROOMS[t].cost));
    sound('build'); sound('anvil', { delay: 0.2 }); sound('unlock', { delay: 0.5 });
    send('build', `${ROOMS[t].icon} ${ROOMS[t].name}`); toast(`${ROOMS[t].icon} ${ROOMS[t].name} built!`, rooms.length ? 'It is joined to the house by a hallway. Walk in through the front door.' : 'Your cottage has a glowing front door now ✨');
    close();
  };
  return (
    <div className="col">
      <h2>🏡 {rooms.length ? 'Expand our house' : 'Build our first room'}</h2>
      {rooms.length > 0 && (
        <>
          <div className="small muted">Where should the new room go?</div>
          <div className="row wrap">{slots.map((s, i) => <Tap key={i} className={'pill' + (i === slot ? ' on' : '')} onClick={() => setSlot(i)}>{s.label}</Tap>)}</div>
          {!slots.length && <div className="banner">The plot is full: every side is built!</div>}
        </>
      )}
      <div className="grid2">
        {types.map((t) => (
          <Tap key={t} className={'opt' + (t === pre ? ' on' : '')} disabled={!slots.length || locked(t) || !canAfford(w.inv, ROOMS[t].cost)} onClick={() => go(t)}>
            <b>{ROOMS[t].icon} {ROOMS[t].name}</b><div className="small muted">{locked(t) ? '🔒 Find its Ancient Blueprint Scroll in the ruins' : ROOMS[t].blurb}</div><div className="small">{costText(ROOMS[t].cost)}</div>
          </Tap>
        ))}
      </div>
      {!types.length && <div className="small muted">Every room is built. You did it, together. 💞</div>}
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
      <Tap className="btn ghost" onClick={() => song.forEach((n, i) => setTimeout(() => note(n), i * 330))}>▶ Play our song</Tap>
    </div>
  );
}

function Stars({ close, path }: { close: () => void; path: string }) {
  const { me, send } = useVelvet();
  const stars = useMemo(() => Array.from({ length: 90 }, () => ({ x: Math.random() * 100, y: Math.random() * 100, s: 1 + Math.random() * 2.5, d: Math.random() * 2 })), []);
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
        <div className="small muted">{wished ? 'Tap again to go back inside' : 'Look: the stars spell us'}</div>
      </div>
    </motion.div>
  );
}

function Movie({ close }: { close: () => void }) {
  const { send, states } = useVelvet();
  const pics = useMemo(() => [...Object.values(MOOD_PHOTOS.arushi).flat(), ...Object.values(MOOD_PHOTOS.shaurya).flat(), states.shaurya.cutout, states.arushi.cutout].filter(Boolean) as string[], []); // eslint-disable-line
  const [i, setI] = useState(0);
  useEffect(() => { send('world', 'started a movie night in the mini-cinema 🎬'); const t = setInterval(() => setI((x) => x + 1), 3200); return () => clearInterval(t); }, []); // eslint-disable-line
  return (
    <motion.div className="movie" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <AnimatePresence mode="wait">
        {pics.length ? <motion.img key={i} src={pics[i % pics.length]} initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }} /> : <h2>🎬 Add photos to start the reel</h2>}
      </AnimatePresence>
      <div className="small muted" style={{ position: 'absolute', bottom: 16 }}>Our little film · tap to leave the cinema</div>
    </motion.div>
  );
}
void Icon; void TOOLS;
