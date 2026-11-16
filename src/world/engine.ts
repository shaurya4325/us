// The game engine: one renderer, one live scene at a time (Overworld XOR Interior), fixed 45° iso camera rig,
// camera-relative joystick movement, partner interpolation, pets, love meter, couple actions and adaptive resolution.
import * as THREE from 'three';
import { Chibi, petMesh, type Anim } from './chibi';
import { Overworld } from './overworld';
import { Interior } from './interior';
import { Net, type Act, type Snap } from './net';
import { Kit, Particles, SEE, Shadows, heartTex, mat, softDot } from './gfx';
import { PETS, TOOLS, item, GIFTABLE, type PetId, type ToolId } from './catalog';
import type { EngineAPI, Interactable, SceneAPI, WorldDoc } from './types';
import { PEOPLE, CAPES, type Who } from '../config/people';
import { sound } from './sound';
import { CoopTasks } from './CoopTasks';
import { PLACEABLE } from './decor';
import { dayKey } from '../data/craftingRegistry';
import { biomeAt, type BiomeId, type Surface } from '../data/biomes';
const biomeOf = (x: number, z: number) => biomeAt(x, z)[0];
import type { Buff } from '../data/items';

export type Held = ToolId | string;

export interface HudState {
  ctx: { label: string; icon: string; locked?: string; tint?: string } | null;
  love: number; near: boolean; scene: 'over' | 'inside'; holding: boolean;
  partnerScene: 'over' | 'inside' | null; moment: boolean; fps: number; calls: number; link: 'p2p' | 'cloud'; dpr: number; synergy: boolean;
  biome: BiomeId | null; held: string; buffs: { b: Buff; left: number }[]; tri: number;
  pBiome: BiomeId | null; pArrow: number | null; pDist: number;
}
export interface EngineOpts {
  canvas: HTMLCanvasElement; overlay: HTMLElement; fade: HTMLElement;
  me: Who; base: string; world: WorldDoc;
  patch: (fields: Record<string, any>, incs?: Record<string, number>) => void;
  onHud: (h: HudState) => void; onUi: (panel: string, data?: any) => void;
  toast: (title: string, body?: string) => void;
  onCouple: (kind: string, from: Who) => void;
  /** partner acts the UI cares about (craft-together prompts, gifts) */
  onPartnerAct: (a: Act) => void;
  /** the engine switched the held item (e.g. auto-equipped the right tool) */
  onHeld: (h: string) => void;
  solo: boolean;
}

const YAW = Math.PI / 4, PITCH = THREE.MathUtils.degToRad(42), FOV = 30;
const angLerp = (a: number, b: number, k: number) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

interface Pet { id: PetId; owner: Who; mesh: THREE.Mesh; x: number; z: number; y: number; yaw: number; hop: number; target: [number, number] | null }

export class Engine implements EngineAPI {
  me: Who; partner: Who; world: WorldDoc; host: boolean; partnerName: string; coop: CoopTasks;
  player = { x: 0, y: 0, z: 0 };
  partnerAt = { x: 0, y: 0, z: 0, here: false };
  private heldId: Held = 'none'; private buffs: { b: Buff; until: number }[] = []; private trailT = 0; private wasWater = false;
  private parcels: { mesh: THREE.Mesh; from: THREE.Vector3; to: () => THREE.Vector3; t: number; item: string; mine: boolean }[] = [];
  private o: EngineOpts;
  private renderer: THREE.WebGLRenderer; private camera: THREE.PerspectiveCamera;
  private cur!: SceneAPI; private net: Net;
  private mine: Chibi; private them: Chibi;
  private shadows = new Shadows(24); private sparks = new Particles(420, softDot()); private hearts = new Particles(90, heartTex());
  private tether: THREE.Line; private tetherPos: Float32Array;
  private pets: Pet[] = [];
  // state
  private vel = new THREE.Vector2(); private vy = 0; private grounded = true; private yaw = 0;
  private joy = new THREE.Vector2(); private keys = new Set<string>();
  private animUntil = 0; private animOverride: Anim | null = null;
  private pSnap: Snap | null = null; private pPos = new THREE.Vector3(); private pYaw = 0; private pSeen = 0; private pAirY = 0;
  private moment: { kind: string; from: Who; until: number; mx: number; mz: number; my: number; tx: number; tz: number; yaw: number; ptx: number; ptz: number; pyaw: number; gap: number } | null = null;
  private momentEl: HTMLDivElement | null = null; private momentHeartT = 0; private camD = 23;
  private love = 0; private holdingWho: Who | null = null; private lastHarvest = 0; private pHarvest = 0;
  private timeScale = 1; private stopUntil = 0; private shakeA = 0;
  private camTarget = new THREE.Vector3(); private camOff = new THREE.Vector3(); private look = new THREE.Vector3();
  private v1 = new THREE.Vector3(); private v2 = new THREE.Vector3(); private dbs = new THREE.Vector2();
  private t = 0; private last = performance.now(); private raf = 0; private alive = true; private fading = false;
  private fpsT = 0; private frames = 0; private fps = 60; private dpr: number; private maxDpr: number; private goodFor = 0;
  private hudT = 0; private ctxT = 0; private lastHud = ''; private sendT = 0; private stepT = 0; private heartT = 0; private sniffT = 0;
  private ctx: Interactable | null = null; private bubbles: { el: HTMLDivElement; who: Who; until: number }[] = [];
  private pops: { el: HTMLDivElement; x: number; y: number; z: number; t: number }[] = [];

  constructor(o: EngineOpts) {
    this.o = o; this.me = o.me; this.partner = o.me === 'shaurya' ? 'arushi' : 'shaurya'; this.world = o.world;
    this.host = o.me === 'shaurya' || o.solo; this.partnerName = PEOPLE[this.partner].name;
    this.renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.info.autoReset = false;
    this.maxDpr = Math.min(window.devicePixelRatio || 1, 1.5); this.dpr = this.maxDpr;
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 140);
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.kd); window.addEventListener('keyup', this.ku);
    this.mine = new Chibi(PEOPLE[this.me].look, PEOPLE[this.me].name, PEOPLE[this.me].aura);
    this.them = new Chibi(PEOPLE[this.partner].look, PEOPLE[this.partner].name, PEOPLE[this.partner].aura);
    // Shaurya stands on the left and reaches with his left hand, Arushi on the right with her right
    this.mine.handSide = this.me === 'shaurya' ? 'L' : 'R'; this.them.handSide = this.partner === 'shaurya' ? 'L' : 'R';
    this.tetherPos = new Float32Array(20 * 3);
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(this.tetherPos, 3));
    this.tether = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xffb3d4, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tether.frustumCulled = false;
    this.net = new Net(o.base, o.me);
    this.net.onSnap = (s) => { this.pSnap = s; this.pSeen = performance.now(); };
    this.net.onAct = (a) => this.onAct(a);
    this.coop = new CoopTasks(o.me, (k, d) => this.net.act({ k, t: Date.now(), d }), o.solo);
    this.coop.onKeyDone = (id) => (this.cur as any).keyDone?.(id, this);
    this.coop.onHitSynced = (id) => { (this.cur as any).giantHit?.(id, this); this.popup('♪ in rhythm!', this.player.x, this.player.y + 2, this.player.z); };
    this.coop.onPartnerKey = (id) => (this.cur as any).partnerKey?.(id);
    this.mount(new Overworld());
    this.applyCapes();
    this.raf = requestAnimationFrame(this.loop);
  }

  /* ---------- scene lifecycle ---------- */
  private owned(): THREE.Object3D[] { return [this.mine.root, this.them.root, this.shadows.mesh, this.sparks.points, this.hearts.points, this.tether, ...this.pets.map((p) => p.mesh)]; }
  private mount(s: SceneAPI) {
    this.cur = s;
    s.setWorld(this.world, this);
    s.scene.add(...this.owned());
    const [x, y, z] = s.spawn(this.me);
    this.player.x = x; this.player.y = y; this.player.z = z; this.vy = 0; this.yaw = 0;
    if (this.pSnap && this.pSnap.s === s.kind) this.pPos.set(...this.pSnap.p);
    else { const [px, py, pz] = s.spawn(this.partner); this.pPos.set(px, py, pz); }
    this.pets.forEach((p) => { p.x = x + (Math.random() - 0.5) * 2; p.z = z + 1; p.y = y; p.target = null; });
    this.ctx = null; this.ctxT = 0;
    this.camTarget.set(x, y, z);
  }
  private swap(make: () => SceneAPI) {
    if (this.fading) return;
    this.fading = true;
    const f = this.o.fade; f.style.opacity = '1'; sound('door'); sound('latch', { delay: 0.25 });
    setTimeout(() => {
      if (!this.alive) return;
      const old = this.cur;
      old.scene.remove(...this.owned());
      old.dispose(); this.renderer.renderLists.dispose();      // the outside world is fully unloaded
      this.mount(make());
      this.renderer.compile(this.cur.scene, this.camera);
      requestAnimationFrame(() => { f.style.opacity = '0'; sound('doorShut'); setTimeout(() => (this.fading = false), 350); });
    }, 360);
  }
  enter = () => { if (Object.keys(this.world.rooms ?? {}).length) this.swap(() => new Interior(this.world)); };
  exit = () => this.swap(() => new Overworld());

  setWorld(w: WorldDoc) {
    const petsChanged = JSON.stringify(w.pets) !== JSON.stringify(this.world.pets), capes = JSON.stringify(w.capes) !== JSON.stringify(this.world.capes);
    this.world = w; this.cur.setWorld(w, this);
    if (petsChanged) this.syncPets();
    if (capes) this.applyCapes();
  }
  private applyCapes() {
    const c = this.world.capes ?? {};
    if (c[this.me] !== undefined) this.mine.setCape(CAPES[c[this.me]! % CAPES.length]);
    if (c[this.partner] !== undefined) this.them.setCape(CAPES[c[this.partner]! % CAPES.length]);
  }
  private syncPets() {
    const want = Object.entries(this.world.pets ?? {}) as [PetId, { owner: Who }][];
    for (const p of this.pets.filter((p) => !want.some(([id]) => id === p.id))) { this.cur.scene.remove(p.mesh); p.mesh.geometry.dispose(); }
    this.pets = this.pets.filter((p) => want.some(([id]) => id === p.id));
    for (const [id, v] of want) {
      if (this.pets.some((p) => p.id === id)) continue;
      const P = PETS[id], mesh = new THREE.Mesh(petMesh(P.body, P.ear, id), mat());
      const pet: Pet = { id, owner: v.owner, mesh, x: this.player.x + 1, z: this.player.z + 1, y: this.player.y, yaw: 0, hop: 0, target: null };
      this.pets.push(pet); this.cur.scene.add(mesh);
    }
  }

  /* ---------- input ---------- */
  setJoy(x: number, y: number) { this.joy.set(x, y); if ((x || y) && this.holdingWho && this.holdingWho !== this.me) this.holdingWho = null; }
  jump() { if (this.grounded) { this.vy = 7.2; this.grounded = false; sound('jump'); } }
  /** what the hotbar has selected: a tool id, an item id, or 'none' */
  setHeld(h: Held) { this.heldId = h; }
  held = () => (this.heldId in TOOLS ? (this.heldId as ToolId) : 'none') as ToolId | 'none';
  tier = (t: ToolId) => this.world.tiers?.[t] ?? 0;
  holding = () => !!this.holdingWho;
  private kd = (e: KeyboardEvent) => { this.keys.add(e.key.toLowerCase()); if (e.key === ' ') this.jump(); if (e.key.toLowerCase() === 'e') this.interact(); };
  private ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private resize = () => {
    const c = this.o.canvas, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight;
    this.renderer.setPixelRatio(this.dpr); this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  };

  interact() {
    const c = this.ctx; if (!c || this.fading) return;
    if (c.needs && !this.toolFor(c.needs)) { this.toast(`${TOOLS[c.needs].icon} You need the ${TOOLS[c.needs].name}`, 'Craft it at the Crafting Table by the house plot'); return; }
    if (c.minTier && c.tool && this.tier(c.tool) < c.minTier) { this.toast(`${TOOLS[c.tool].icon} Your ${TOOLS[c.tool].name} is too weak`, `Upgrade it to tier ${c.minTier + 1} at the Starlight Anvil`); return; }
    if (c.tool && c.tool !== this.heldId && this.toolFor(c.tool)) { this.heldId = c.tool; this.o.onHeld(c.tool); sound('select', { vol: 0.6 }); }
    if (c.id.startsWith('pet:')) return this.petPet(c.id.slice(4) as PetId);
    if (c.id.startsWith('held:')) return this.useHeld(c.id.slice(5));
    if (c.id === 'plant') {
      if ((this.world.inv?.flower ?? 0) < 1) { this.toast('🌼 Need 1 flower to plant a sapling'); return; }
      const id = 'p' + Date.now().toString(36);
      this.patch({ [`planted.${id}`]: { x: this.player.x, z: this.player.z + 0.8, at: Date.now(), by: this.me } }, { 'inv.flower': -1 });
      this.play('pat', 0.6); this.fx('leaf', this.player.x, this.player.y + 0.3, this.player.z + 0.8, 12); sound('pick');
      return;
    }
    this.cur.interact(c.id, this);
  }

  /* ---------- held hotbar items: place decor, eat treats, gift parcels, the hammer and the brush ---------- */
  private useHeld(kind: string) {
    const h = this.heldId, P = this.player;
    if (kind === 'place') {
      if ((this.world.inv?.[h] ?? 0) < 1) { this.toast(`${item(h).icon} None left`, 'Craft more at the table or the loom'); return; }
      const fx = P.x + Math.sin(this.yaw) * 0.9, fz = P.z + Math.cos(this.yaw) * 0.9, gy = this.cur.ground(fx, fz, P.y + 0.3);
      if (gy === null) { this.toast('No room here', 'Try a flatter, clearer spot'); return; }
      const id = 'd' + Date.now().toString(36);
      this.patch({ [`decor.${id}`]: { item: h, s: this.cur.kind, x: fx, y: gy, z: fz, r: Math.round((this.yaw + Math.PI) / (Math.PI / 4)) * (Math.PI / 4), by: this.me, at: Date.now() } }, { [`inv.${h}`]: -1 });
      this.play('pat', 0.5); sound('build'); this.fx('spark', fx, gy + 0.4, fz, 12);
      if ((this.world.inv?.[h] ?? 0) <= 1) { this.heldId = 'none'; this.o.onHeld('none'); }
      return;
    }
    if (kind === 'eat') return this.eat(h);
    if (kind === 'gift') return this.gift(h);
    if (kind === 'hammer') { sound('book'); return this.ui('build'); }
    if (kind === 'brush') { const r = (this.cur as Interior).roomAt?.(P.x, P.z, P.y); if (r) { sound('open'); this.ui('paint', r.id); } return; }
  }
  eat(id: string) {
    const I = item(id); if (I.cat !== 'treat' || (this.world.inv?.[id] ?? 0) < 1) return;
    this.patch({}, { [`inv.${id}`]: -1, [`stats.ate`]: 1 });
    this.play('kiss', 0.8); sound('pop'); sound('ding', { delay: 0.25 }); this.fx('heart', this.player.x, this.player.y + 1.4, this.player.z, 8);
    const until = performance.now() + 180_000;
    if (I.buff === 'speed') this.buffs.push({ b: 'speed', until });
    if (I.buff === 'hearts') this.buffs.push({ b: 'hearts', until });
    if (I.buff === 'love') this.love = 1;
    if (I.buff === 'energy' || I.buff === 'cozy') this.ui('energy', I.buff === 'energy' ? 100 : 30);
    this.toast(`${I.icon} ${I.name}`, I.blurb ?? 'Yum');
    if ((this.world.inv?.[id] ?? 0) <= 1 && this.heldId === id) { this.heldId = 'none'; this.o.onHeld('none'); }
  }
  /** wrap an item in a glowing pink parcel that flies to the partner's character */
  gift(id: string) {
    if ((this.world.inv?.[id] ?? 0) < 1 || !GIFTABLE(id)) return;
    this.patch({}, { [`inv.${id}`]: -1, [`giftbox.${this.partner}.${id}`]: 1, 'stats.gift': 1, ...this.quest('gift') });
    this.net.act({ k: 'gift', t: Date.now(), d: { item: id } });
    this.launchParcel(id, true); sound('gift'); this.play('wave', 1);
    this.toast(`🎁 ${item(id).icon} sent to ${this.partnerName}`, 'Wrapped in pink and on its way');
    if ((this.world.inv?.[id] ?? 0) <= 1 && this.heldId === id) { this.heldId = 'none'; this.o.onHeld('none'); }
  }
  private launchParcel(id: string, mine: boolean) {
    const geo = new Kit().box(0.36, 0.3, 0.36, 0xff7db5, 0, -0.15, 0).box(0.38, 0.06, 0.1, 0xfff1f6, 0, 0, 0).box(0.1, 0.32, 0.38, 0xfff1f6, 0, -0.16, 0).ball(0.08, 0xfff1f6, -0.06, 0.07, 0, 1.2, 0.8, 0.6).ball(0.08, 0xfff1f6, 0.06, 0.07, 0, 1.2, 0.8, 0.6).build();
    const mesh = new THREE.Mesh(geo, mat()); this.cur.scene.add(mesh);
    const meP = () => new THREE.Vector3(this.player.x, this.player.y + 1.2, this.player.z), thP = () => this.v1.set(this.pPos.x, this.pPos.y + 1.2, this.pPos.z).clone();
    this.parcels.push({ mesh, from: mine ? meP() : thP(), to: mine ? thP : meP, t: 0, item: id, mine });
  }

  couple(kind: string, text = '') {
    const t = Date.now();
    if (kind === 'hands') { this.holdingWho = this.holdingWho ? null : this.me; this.net.act({ k: 'couple', t, d: { kind, on: !!this.holdingWho } }); if (!this.holdingWho) return; }
    else if (kind === 'whisper') { this.net.act({ k: 'whisper', t, d: { text } }); this.bubble(this.me, text); this.startMoment('whisper', this.me); sound('pop'); return; }
    else if (kind === 'wave') { this.net.act({ k: 'couple', t, d: { kind } }); this.play('wave', 1.6); sound('pop'); return; }
    else this.net.act({ k: 'couple', t, d: { kind } });
    this.coupleFx(kind, this.me);
  }
  /** both step together, face each other, the camera leans in, a caption pops and hearts stream */
  private startMoment(kind: string, from: Who) {
    const P = this.player;
    const SPEC: Record<string, [number, number, string]> = {
      hug: [0.8, 2.8, '🤗 Hug!'], kiss: [0.92, 2.6, '💋 Kiss!'], pat: [1.0, 2.6, '🫳 Head pat!'], dance: [1.4, 3.4, '💃 Dance together!'],
      whisper: [0.88, 2.8, ''],                         // the speech bubble is the caption hands: [0.95, 2.0, '🤝 Holding hands'],
    };
    const [gap, secs, label] = SPEC[kind] ?? [0.6, 2.4, '💞'];
    // stand side by side across the screen (Shaurya left, Arushi right on both phones), angled a little toward the camera
    const tilt = 0, rx = Math.cos(YAW), rz = -Math.sin(YAW), fx = -Math.sin(YAW), fz = -Math.cos(YAW);
    const ax = rx * Math.cos(tilt) + fx * Math.sin(tilt), az = rz * Math.cos(tilt) + fz * Math.sin(tilt);
    const side = this.me === 'shaurya' ? 1 : -1;                     // +1: my partner is to my right
    const dx = ax * side, dz = az * side;
    const mx = (P.x + this.pPos.x) / 2, mz = (P.z + this.pPos.z) / 2;
    // face each other, but cheated a third of the way toward the camera so both faces are visible (stage trick)
    const yaw = kind === 'hands' ? YAW : angLerp(Math.atan2(dx, dz), YAW, 0.38);
    const pyawFace = kind === 'hands' ? YAW : angLerp(Math.atan2(-dx, -dz), YAW, 0.38);
    this.moment = { kind, from, until: performance.now() + secs * 1000, mx, mz, my: Math.max(P.y, this.pPos.y), gap,
      tx: mx - (dx * gap) / 2, tz: mz - (dz * gap) / 2, yaw, ptx: mx + (dx * gap) / 2, ptz: mz + (dz * gap) / 2, pyaw: pyawFace };
    this.vel.set(0, 0); this.animOverride = null;
    this.momentEl?.remove();
    this.momentEl = null;
    if (label) { const el = document.createElement('div'); el.className = 'moment'; el.textContent = label; this.o.overlay.appendChild(el); this.momentEl = el; }
  }
  /** where the partner should stand during a moment (used by the local solo-test bot) */
  momentForPartner() {
    const m = this.moment;
    if (!m || m.gap === 0 || performance.now() > m.until) return null;
    const mine = m.from === this.me;
    const anim = ({ hug: 'hug', kiss: 'kiss', pat: mine ? 'patted' : 'pat', dance: 'dance', whisper: mine ? 'listen' : 'whisper' } as Record<string, string>)[m.kind] ?? 'idle';
    return { x: m.ptx, z: m.ptz, yaw: m.pyaw, anim: m.kind === 'hands' ? 'hands' : anim };
  }
  private coupleFx(kind: string, from: Who) {
    if (kind !== 'hands' || this.holdingWho) this.startMoment(kind, from);
    const mx = (this.player.x + this.pPos.x) / 2, mz = (this.player.z + this.pPos.z) / 2, my = Math.max(this.player.y, this.pPos.y) + 1.6;
    this.hearts.burst(mx, my, mz, kind === 'kiss' ? 22 : 14, kind === 'kiss' ? 0xff3e8a : 0xffb3d4, 1.2, 1.6, 0.5, 1.6, false);
    if (kind === 'kiss') { sound('kiss'); sound('sparkle', { delay: 0.35, vol: 0.6 }); }
    else if (kind === 'hug') { sound('hug'); sound('sparkle', { delay: 0.2, vol: 0.6 }); }
    else if (kind === 'pat') { sound('squish'); sound('chime', { delay: 0.2 }); }
    else if (kind === 'dance') { sound('chime'); sound('shimmer', { delay: 0.3 }); }
    else sound('shimmer');
    if (from === this.me && ['hug', 'kiss', 'dance'].includes(kind)) this.patch({}, this.quest(kind));
    this.o.onCouple(kind, from);
  }
  private onAct(a: Act) {
    if (a.k === 'couple') {
      if (a.d.kind === 'wave') { sound('pop'); this.bubble(this.partner, '👋'); return; }
      if (a.d.kind === 'hands') this.holdingWho = a.d.on ? this.partner : null;
      this.coupleFx(a.d.kind, this.partner);
    }
    if (a.k === 'whisper') { this.bubble(this.partner, a.d.text); this.startMoment('whisper', this.partner); sound('pop'); }
    if (a.k === 'harvest') this.pHarvest = Date.now();
    if (a.k === 'key' || a.k === 'hit') this.coop.partner(a.k, a.d);
    if (a.k === 'gift') { this.launchParcel(a.d.item, false); sound('gift'); }
    if (a.k === 'gift' || a.k === 'ct') this.o.onPartnerAct(a);
    if (a.k === 'petted') { const p = this.pets.find((x) => x.id === a.d.id); if (p) { p.hop = 0.6; this.hearts.burst(p.x, p.y + 0.8, p.z, 6, 0xff9ec4, 0.6, 1, 0.35, 1.2, false); } }
  }
  private petPet(id: PetId) {
    const p = this.pets.find((x) => x.id === id); if (!p) return;
    p.hop = 0.6; this.play('pat', 1); sound('squeak'); sound('sparkle', { delay: 0.15, vol: 0.5 });
    this.hearts.burst(p.x, p.y + 0.8, p.z, 8, 0xff9ec4, 0.6, 1, 0.35, 1.2, false);
    this.net.act({ k: 'petted', t: Date.now(), d: { id } });
    this.patch({}, { [`stats.pet_${id}`]: 1 });
  }

  /** send a raw act to the partner (craft-together prompts) */
  sendAct = (k: string, d: any) => this.net.act({ k, t: Date.now(), d });
  /* small read-only hooks (used by the local solo-test bot) */
  sceneKind() { return this.cur.kind; }
  myAnim() { return this.mine.anim as string; }
  groundAt(x: number, z: number, y: number) { return this.cur.ground(x, z, y); }
  coopHint() { return (this.cur as any).coopHint?.(this.player) ?? null; }

  /* ---------- EngineAPI for scenes ---------- */
  now = () => Date.now();
  toolFor = (t?: ToolId) => !t || !!this.world.tools?.[t];
  synergy = () => (Date.now() - this.pHarvest < 5000 && this.pPos.distanceTo(this.v1.set(this.player.x, this.player.y, this.player.z)) < 7 && this.pSnap?.s === this.cur.kind ? 2 : 1);
  patch = (f: Record<string, any>, i: Record<string, number> = {}) => this.o.patch(f, i);
  give = (res: Record<string, number>, x: number, y: number, z: number) => {
    const inc: Record<string, number> = {}, syn = this.synergy() > 1;
    for (const k in res) { inc[`inv.${k}`] = res[k]; inc[`stats.${k}`] = res[k]; Object.assign(inc, this.quest(`r:${k}`, res[k])); }
    if (syn) Object.assign(inc, this.quest('tether'));
    this.patch({}, inc);
    this.popup(Object.entries(res).map(([k, v]) => `+${v} <i style="filter:${item(k).tint ?? 'none'}">${item(k).icon}</i>`).join(' ') + (syn ? ' ✦2×' : ''), x, y, z, true);
    sound('collect'); if (res.gem || res.star) sound('coins', { delay: 0.15 }); this.lastHarvest = Date.now();
    this.net.act({ k: 'harvest', t: Date.now() });
  };
  /** increments for today's quest progress on event ev (merge into a patch) */
  quest = (ev: string, n = 1) => ({ [`quests.${dayKey()}.p.${ev}`]: n });
  fx = (kind: string, x: number, y: number, z: number, n = 12) => {
    const C: Record<string, [number, number, number, number, boolean, Particles]> = {
      leaf: [0x8fd694, 1.6, 2.4, 0.3, true, this.sparks], blossom: [0xffb7d0, 1.6, 2.2, 0.3, true, this.sparks], spark: [0xfff0b0, 1.2, 2.5, 0.28, true, this.sparks],
      stone: [0xd8d2e6, 1.5, 2.6, 0.25, true, this.sparks], crystal: [0xff7db5, 1.4, 3, 0.35, true, this.sparks], splash: [0x9ef0ea, 1.2, 3.2, 0.3, true, this.sparks],
      gold: [0xffd27a, 1.0, 2.8, 0.32, true, this.sparks], heart: [0xff7db5, 0.8, 1.4, 0.45, false, this.hearts], star: [0xfff0a0, 1.3, 2.2, 0.3, false, this.sparks],
    };
    const c = C[kind] ?? C.spark;
    c[5].burst(x, y, z, n, c[0], c[1], c[2], c[3], 0.9, c[4]);
    if (this.synergy() > 1 && kind !== 'heart') this.sparks.burst(x, y + 0.3, z, 8, 0xffffff, 0.8, 1.5, 0.4, 1.2, false);
  };
  sound = (s: string, opt?: { vol?: number; rate?: number; delay?: number }) => sound(s, opt);
  ui = (p: string, d?: any) => this.o.onUi(p, d);
  toast = (a: string, b?: string) => this.o.toast(a, b);
  swing = () => { const t = this.heldId in TOOLS ? this.tier(this.heldId as ToolId) : 0; this.mine.swing(1 + t * 0.12); sound('swoosh'); if (t > 0) this.sparks.burst(this.player.x + Math.sin(this.yaw) * 0.5, this.player.y + 0.9, this.player.z + Math.cos(this.yaw) * 0.5, 4 + t * 2, [0xffffff, 0xe4def0, 0xff9ec4, 0xf2b8a0, 0xfff0a0][t], 0.5, 0.8, 0.22, 0.5, false); };
  hitStop = (ms: number) => { this.stopUntil = performance.now() + ms; };
  shake = (a: number) => { this.shakeA = Math.max(this.shakeA, a); };
  play = (a: string, secs: number) => { this.animOverride = a as Anim; this.animUntil = performance.now() + secs * 1000; };

  /* ---------- DOM overlays (speech bubbles, +resource popups) ---------- */
  private bubble(who: Who, text: string) {
    const el = document.createElement('div'); el.className = 'bubble'; el.textContent = text;
    this.o.overlay.appendChild(el); this.bubbles.push({ el, who, until: performance.now() + 4200 });
  }
  private popup(text: string, x: number, y: number, z: number, html = false) {
    const el = document.createElement('div'); el.className = 'popup'; if (html) el.innerHTML = text; else el.textContent = text;
    this.o.overlay.appendChild(el); this.pops.push({ el, x, y, z, t: 0 });
  }
  private project(x: number, y: number, z: number) {
    this.v2.set(x, y, z).project(this.camera);
    const c = this.o.canvas;
    return [(this.v2.x * 0.5 + 0.5) * c.clientWidth, (-this.v2.y * 0.5 + 0.5) * c.clientHeight];
  }

  /* ---------- frame ---------- */
  private loop = (now: number) => {
    if (!this.alive) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 1.5) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; this.adapt(); }
    if (now < this.stopUntil) dt *= 0.05;                      // hit-stop
    this.t += dt;
    this.step(dt, now);
    this.renderer.info.reset();
    this.renderer.render(this.cur.scene, this.camera);
    this.hudT += dt;
    if (this.hudT > 0.12) { this.hudT = 0; this.emitHud(); }
  };

  private adapt() {
    if (this.fps < 52 && this.dpr > 1) { this.dpr = Math.max(1, this.dpr - 0.25); this.goodFor = 0; this.resize(); }
    else if (this.fps >= 58 && this.dpr < this.maxDpr) { if ((this.goodFor += 1) > 5) { this.dpr = Math.min(this.maxDpr, this.dpr + 0.25); this.goodFor = 0; this.resize(); } }
  }

  private step(dt: number, now: number) {
    const P = this.player, S = this.cur;
    // --- camera-relative joystick: moveDir = normalize(camRight * joyX + camForward * (-joyY))
    let mo = this.moment && performance.now() < this.moment.until ? this.moment : null;
    if (!mo && this.moment) { this.moment = null; this.momentEl?.remove(); this.momentEl = null; }
    if (mo && this.pSnap?.s !== S.kind) { this.moment = null; this.momentEl?.remove(); this.momentEl = null; mo = null; }
    let jx = mo ? 0 : this.joy.x, jy = mo ? 0 : this.joy.y;
    if (this.keys.size && !mo) { jx += (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0); jy += (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) - (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0); }
    const fwdX = -Math.sin(YAW), fwdZ = -Math.cos(YAW), rgtX = Math.cos(YAW), rgtZ = -Math.sin(YAW);
    let mx = rgtX * jx + fwdX * -jy, mz = rgtZ * jx + fwdZ * -jy;
    const mag = Math.min(1, Math.hypot(jx, jy));
    // holding hands: the follower drifts to the leader's side while idle
    if (!mo && this.holdingWho === this.partner && mag < 0.05 && this.pSnap?.s === S.kind) {
      const tx = this.pPos.x + Math.cos(this.pYaw) * 0.75, tz = this.pPos.z - Math.sin(this.pYaw) * 0.75, d = Math.hypot(tx - P.x, tz - P.z);
      if (d > 0.25) { mx = (tx - P.x) / d; mz = (tz - P.z) / d; }
    }
    const ml = Math.hypot(mx, mz), surf: Surface = S.surface(P.x, P.z, P.y), swimming = S instanceof Interior && S.inPool(P.x, P.z, P.y);
    const wading = !swimming && surf === 'water', fast = this.buffs.some((b) => b.b === 'speed' && b.until > performance.now());
    const speed = (swimming ? 2.4 : wading ? 3.0 : 4.6) * (fast ? 1.2 : 1) * (ml > 0.01 ? Math.max(mag, this.holdingWho === this.partner && mag < 0.05 ? 0.8 : 0) : 0);
    const tvx = ml > 0.01 ? (mx / ml) * speed : 0, tvz = ml > 0.01 ? (mz / ml) * speed : 0;
    const acc = 1 - Math.exp(-(ml > 0.01 ? 12 : 16) * dt);
    this.vel.x += (tvx - this.vel.x) * acc; this.vel.y += (tvz - this.vel.y) * acc;
    const g0 = S.ground(P.x, P.z, P.y) ?? P.y;
    const tryMove = (nx: number, nz: number) => {
      const g = S.ground(nx, nz, P.y);
      if (g === null) return false;
      if (this.grounded && g < g0 - 1.0) return false;      // no walking off ledges
      if (g > P.y + 0.6) return false;                       // walls & cliffs: jump to climb small ledges
      P.x = nx; P.z = nz; return true;
    };
    // slide along obstacles instead of sticking: try the full step, then each axis
    const nx = P.x + this.vel.x * dt, nz = P.z + this.vel.y * dt;
    if (!tryMove(nx, nz)) { if (!tryMove(nx, P.z)) this.vel.x *= 0.3; if (!tryMove(P.x, nz)) this.vel.y *= 0.3; }
    // vertical
    const g = S.ground(P.x, P.z, P.y) ?? g0;
    this.vy -= 22 * dt; P.y += this.vy * dt;
    if (P.y <= g) {
      if (!this.grounded && this.vy < -4) { sound(surf === 'wood' ? 'land:wood' : surf === 'water' ? 'splash' : 'land', { vol: Math.min(1, -this.vy / 9) }); this.sparks.burst(P.x, g + 0.05, P.z, 6, 0xffffff, 0.8, 0.6, 0.25, 0.4); }
      P.y = g; this.vy = 0; this.grounded = true;
    }
    else if (P.y - g > 0.08) this.grounded = false;
    if (this.grounded && P.y - g < 0.5) P.y = g;
    if (mo && mo.gap) {
      const k = 1 - Math.exp(-9 * dt), mx2 = P.x + (mo.tx - P.x) * k, mz2 = P.z + (mo.tz - P.z) * k;
      if (S.ground(mx2, mz2, P.y + 0.5) !== null) { P.x = mx2; P.z = mz2; }
      if (mo.kind !== 'dance') this.yaw = angLerp(this.yaw, mo.yaw, k);
    }
    const spd = mo ? 0 : Math.hypot(this.vel.x, this.vel.y);
    if (spd > 0.3) this.yaw = angLerp(this.yaw, Math.atan2(this.vel.x, this.vel.y), 1 - Math.exp(-12 * dt));
    // splash when stepping into water
    if (wading !== this.wasWater) { if (wading) { sound('splash', { vol: 0.6 }); this.fx('splash', P.x, P.y + 0.2, P.z, 10); } this.wasWater = wading; }
    // my chibi
    const over = this.animOverride && now < this.animUntil ? this.animOverride : null;
    if (over && spd > 0.8 && over !== 'hands') this.animOverride = null;
    const mine = mo ? mo.from === this.me : false;
    const moAnim: Anim | null = mo ? (({ hug: 'hug', kiss: 'kiss', pat: mine ? 'pat' : 'patted', dance: 'dance', whisper: mine ? 'whisper' : 'listen', hands: 'hands' } as Record<string, Anim>)[mo.kind] ?? null) : null;
    const anim: Anim = swimming ? 'swim' : moAnim ?? over ?? (this.holdingWho ? 'hands' : spd > 0.3 ? 'walk' : 'idle');
    this.mine.play(anim); this.mine.speed = spd;
    this.mine.root.position.set(P.x, P.y, P.z); this.mine.root.rotation.y = this.yaw;
    this.mine.update(dt, !this.grounded);
    // what's in my hand: the hotbar tool (or the rod while casting)
    const want = (anim === 'cast' ? 'rod' : this.heldId in TOOLS && this.toolFor(this.heldId as ToolId) ? this.heldId : 'none') as ToolId | 'none';
    this.mine.setTool(want, want === 'none' ? 0 : this.tier(want));
    // footsteps follow the walk cycle (one per foot), surface-aware
    if (swimming) { if (spd > 0.5 && (this.stepT -= dt) <= 0) { this.stepT = 0.6; sound('swim'); } }
    else if (this.mine.stepTick && this.grounded && spd > 0.6) sound('step:' + surf, { vol: Math.min(1, spd / 4) });
    this.mine.stepTick = false;
    const hearts = this.buffs.some((b) => b.b === 'hearts' && b.until > performance.now()) || !!this.world.unlocks?.trail;
    if (hearts && spd > 0.6 && (this.trailT -= dt) <= 0) { this.trailT = 0.18; this.hearts.burst(P.x, P.y + 0.15, P.z, 1, 0xff7db5, 0.2, 0.5, 0.3, 1.2, false); }
    // partner (interpolated)
    const ps = this.pSnap, sameScene = !!ps && ps.s === S.kind && performance.now() - this.pSeen < 20_000;
    this.them.root.visible = sameScene;
    if (ps && sameScene) {
      const k = 1 - Math.exp(-(this.net.mode === 'p2p' ? 14 : 6) * dt);
      const prev = this.v1.copy(this.pPos);
      this.pPos.x += (ps.p[0] - this.pPos.x) * k; this.pPos.z += (ps.p[2] - this.pPos.z) * k; this.pPos.y += (ps.p[1] - this.pPos.y) * k;
      if (this.pPos.distanceTo(this.v2.set(...ps.p)) > 6) this.pPos.set(...ps.p);
      this.pYaw = angLerp(this.pYaw, ps.r, k);
      this.them.speed = prev.distanceTo(this.pPos) / Math.max(dt, 1e-3);
      this.them.play((ps.a as Anim) || 'idle');
      this.them.setTool((ps.tl as ToolId) || 'none', ps.ti ?? 0);
      this.them.root.position.copy(this.pPos); this.them.root.rotation.y = this.pYaw;
      this.them.update(dt, ps.p[1] - (S.ground(ps.p[0], ps.p[2], ps.p[1]) ?? ps.p[1]) > 0.15);
      this.them.stepTick = false;
      if ((ps.b ?? 0) & 1 && this.them.speed > 0.6 && Math.random() < dt * 5) this.hearts.burst(this.pPos.x, this.pPos.y + 0.15, this.pPos.z, 1, 0xff7db5, 0.2, 0.5, 0.3, 1.2, false);
    }
    this.partnerAt.x = this.pPos.x; this.partnerAt.y = this.pPos.y; this.partnerAt.z = this.pPos.z; this.partnerAt.here = sameScene;
    // gift parcels arc between you
    this.parcels = this.parcels.filter((pc) => {
      pc.t += dt / 1.3;
      const to = pc.to(), k = Math.min(1, pc.t);
      pc.mesh.position.lerpVectors(pc.from, to, k); pc.mesh.position.y += Math.sin(k * Math.PI) * 2.2; pc.mesh.rotation.y += dt * 5;
      if (Math.random() < dt * 30) this.sparks.burst(pc.mesh.position.x, pc.mesh.position.y, pc.mesh.position.z, 1, 0xff9ec4, 0.2, 0.3, 0.25, 0.6, false);
      if (k >= 1) {
        this.hearts.burst(to.x, to.y + 0.4, to.z, 14, 0xff7db5, 1, 1.5, 0.5, 1.4, false); sound('sparkle');
        if (!pc.mine) this.toast(`🎁 ${this.partnerName} sent you ${item(pc.item).icon} ${item(pc.item).name}!`, 'It is waiting in your gift box (inventory → Gifts)');
        this.cur.scene.remove(pc.mesh); pc.mesh.geometry.dispose(); (pc.mesh.material as THREE.Material).dispose();
        return false;
      }
      return true;
    });
    // send my snapshot
    if ((this.sendT -= dt) <= 0) { this.sendT = 0.1; this.net.send({ p: [P.x, P.y, P.z], r: this.yaw, a: anim, tl: want, ti: want === 'none' ? 0 : this.tier(want), b: hearts ? 1 : 0, s: S.kind, v: spd, t: Date.now() }); }
    // pets trot after their owner
    this.stepPets(dt, sameScene);
    // love meter + heart tether
    const dist = sameScene ? Math.hypot(this.pPos.x - P.x, this.pPos.z - P.z) : 99;
    const near = dist < 2.6;
    this.love = THREE.MathUtils.clamp(this.love + (near ? dt * 0.28 : -dt * 0.04), 0, 1);
    this.tether.visible = dist < 5.5;
    if (this.tether.visible) {
      const syn = this.synergy() > 1;
      (this.tether.material as THREE.LineBasicMaterial).color.setHex(syn ? 0xffd27a : 0xffb3d4);
      (this.tether.material as THREE.LineBasicMaterial).opacity = THREE.MathUtils.clamp((5.5 - dist) / 3, 0, 0.9);
      for (let i = 0; i < 20; i++) {
        const u = i / 19;
        this.tetherPos[i * 3] = THREE.MathUtils.lerp(P.x, this.pPos.x, u);
        this.tetherPos[i * 3 + 1] = THREE.MathUtils.lerp(P.y + 0.75, this.pPos.y + 0.75, u) + Math.sin(u * Math.PI) * (0.35 + Math.sin(this.t * 3) * 0.08);
        this.tetherPos[i * 3 + 2] = THREE.MathUtils.lerp(P.z, this.pPos.z, u);
      }
      this.tether.geometry.attributes.position.needsUpdate = true;
    }
    if (near && (this.heartT -= dt) <= 0) { this.heartT = 0.45; this.hearts.burst((P.x + this.pPos.x) / 2, P.y + 1.5, (P.z + this.pPos.z) / 2, 1, 0xff9ec4, 0.4, 0.8, 0.35, 2.2, false); }
    // shadows
    this.shadows.begin();
    this.shadows.put(P.x, S.ground(P.x, P.z, P.y + 0.1) ?? P.y, P.z, 0.9);
    if (sameScene) this.shadows.put(this.pPos.x, S.ground(this.pPos.x, this.pPos.z, this.pPos.y + 0.1) ?? this.pPos.y, this.pPos.z, 0.9);
    for (const p of this.pets) if (p.mesh.visible) this.shadows.put(p.x, p.y, p.z, 0.6);
    this.shadows.end();
    // context action: nearest interactable in reach (10x per second is plenty, and keeps garbage low)
    if ((this.ctxT -= dt) <= 0) { this.ctxT = 0.1; this.pickCtx(); }
    // scene + particles
    S.update(dt, this.t, this);
    this.sparks.update(dt); this.hearts.update(dt);
    // camera: exponential spring follow with look-ahead, fixed 45° yaw / 42° pitch
    this.camD += ((mo ? 11.5 : S.kind === 'over' ? 23 : 21) - this.camD) * (1 - Math.exp(-(mo ? 5 : 2.5) * dt));
    const D = this.camD;
    if (mo) this.look.set(mo.mx, mo.my + 1.3, mo.mz);
    else this.look.set(P.x + this.vel.x * 0.35, P.y + 0.6, P.z + this.vel.y * 0.35);
    if (mo && (this.momentHeartT -= dt) <= 0) {
      this.momentHeartT = mo.kind === 'kiss' ? 0.16 : 0.26;
      this.hearts.burst(mo.mx, mo.my + 1.45, mo.mz, mo.kind === 'kiss' ? 4 : 3, mo.kind === 'kiss' ? 0xff3e8a : 0xff9ec4, 0.7, 1.4, 0.6, 1.5, false);
    }
    if (mo && this.momentEl) {
      const [sx, sy] = this.project(mo.mx, mo.my + 2.25, mo.mz);
      this.momentEl.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
    }
    this.camTarget.lerp(this.look, 1 - Math.exp(-8 * dt));
    this.camOff.set(Math.sin(YAW) * Math.cos(PITCH) * D, Math.sin(PITCH) * D, Math.cos(YAW) * Math.cos(PITCH) * D);
    this.camera.position.copy(this.camTarget).add(this.camOff);
    if (this.shakeA > 0.001) { this.camera.position.x += (Math.random() - 0.5) * this.shakeA; this.camera.position.y += (Math.random() - 0.5) * this.shakeA; this.shakeA *= Math.exp(-14 * dt); }
    this.camera.lookAt(this.camTarget);
    // see-through hole around me (canopies/pillars in front dissolve)
    this.camera.updateMatrixWorld();
    this.v2.set(P.x, P.y + 0.85, P.z).project(this.camera);
    const db = this.renderer.getDrawingBufferSize(this.dbs);
    SEE.uP.value.set((this.v2.x * 0.5 + 0.5) * db.x, (this.v2.y * 0.5 + 0.5) * db.y); SEE.uR.value = db.y * (mo ? 0.17 : 0.12); SEE.uZ.value = this.v2.z * 0.5 + 0.5 - 0.0004;
    // DOM overlays
    const tnow = performance.now();
    this.bubbles = this.bubbles.filter((b) => {
      if (tnow > b.until) { b.el.remove(); return false; }
      const pos = b.who === this.me ? P : this.pPos, [sx, sy] = this.project(pos.x, pos.y + 2.4, pos.z);
      b.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
      b.el.style.opacity = b.who === this.me || sameScene ? '1' : '0';
      return true;
    });
    this.pops = this.pops.filter((p) => {
      p.t += dt; if (p.t > 1.3) { p.el.remove(); return false; }
      const [sx, sy] = this.project(p.x, p.y + p.t * 1.2, p.z);
      p.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(${1 + Math.min(p.t * 4, 0.3)})`; p.el.style.opacity = String(1 - Math.max(0, p.t - 0.8) * 2);
      return true;
    });
  }

  private pickCtx() {
    const P = this.player, S = this.cur;
    let best: Interactable | null = null, bd = 1e9;
    const list = S.interactables(P.x, P.z, P.y, this);
    for (const p of this.pets) if (p.mesh.visible) list.push({ id: 'pet:' + p.id, x: p.x, z: p.z, r: 1.3, label: `Pet ${PETS[p.id].name}`, icon: PETS[p.id].icon });
    for (const it of list) {
      if (it.y !== undefined && Math.abs(it.y - P.y) > 1.6) continue;
      const d = Math.hypot(it.x - P.x, it.z - P.z);
      if (d < it.r && d < bd) { bd = d; best = it; }
    }
    // a held item gets the button unless something important (a door, a station, a chest…) is right here
    const h = this.heldId, important = best?.hint === 'important' || best?.id.startsWith('chest:') || best?.id.startsWith('rune:');
    if (!important && h !== 'none') {
      const I = item(h), have = (this.world.inv?.[h] ?? 0) > 0;
      let act: Interactable | null = null;
      if (PLACEABLE.has(h) && have && !(best && h === 'bouquet' && false)) act = { id: 'held:place', x: P.x, z: P.z, r: 9, label: `Place ${I.name}`, icon: I.icon };
      if (I.cat === 'treat' && have) act = { id: 'held:eat', x: P.x, z: P.z, r: 9, label: `Eat ${I.name}`, icon: I.icon };
      if (GIFTABLE(h) && have && this.partnerAt.here && Math.hypot(this.pPos.x - P.x, this.pPos.z - P.z) < 6 && (I.cat !== 'treat' || !act || best === null))
        act = I.cat === 'treat' && act ? act : { id: 'held:gift', x: P.x, z: P.z, r: 9, label: `Gift to ${this.partnerName}`, icon: '🎁' };
      if (h === 'hammer' && this.toolFor('hammer') && S.kind === 'over' && !best) act = { id: 'held:hammer', x: P.x, z: P.z, r: 9, label: 'Blueprints', icon: '🔨' };
      if (h === 'brush' && this.toolFor('brush') && S instanceof Interior && S.roomAt(P.x, P.z, P.y)) act = { id: 'held:brush', x: P.x, z: P.z, r: 9, label: 'Paint this room', icon: '🖌️' };
      if (act && (!best || !best.tool || PLACEABLE.has(h) || I.cat === 'treat')) best = act;
    }
    if (!best && S instanceof Overworld && this.toolFor('can') && (h === 'can' || h === 'none') && S.plantAt(P.x, P.z + 0.8)) best = { id: 'plant', x: P.x, z: P.z, r: 1, label: 'Plant sapling (1🌼)', icon: '🌱', tool: 'can' };
    this.ctx = best;
  }

  private stepPets(dt: number, partnerHere: boolean) {
    const now = Date.now();
    for (const p of this.pets) {
      const mineP = p.owner === this.me;
      p.mesh.visible = mineP || partnerHere;
      if (!p.mesh.visible) continue;
      const ox = mineP ? this.player.x : this.pPos.x, oz = mineP ? this.player.z : this.pPos.z, oy = mineP ? this.player.y : this.pPos.y;
      let tx = ox - 0.9, tz = oz + 0.6;
      if (p.target) { [tx, tz] = p.target; if (Math.hypot(tx - p.x, tz - p.z) < 0.4) { const o = this.cur as Overworld; o.sniff?.(tx, tz); p.target = null; this.toast(`${PETS[p.id].icon} ${PETS[p.id].name} sniffed out something shiny!`, 'Follow the sparkles and dig it up'); sound('shimmer'); } }
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d > 0.3) { const sp = Math.min(d * 2.2, p.target ? 5 : 6); const nx = p.x + (dx / d) * sp * dt, nz = p.z + (dz / d) * sp * dt; const g = this.cur.ground(nx, nz, p.y + 0.5); if (g !== null) { p.x = nx; p.z = nz; p.y = g; } else if (d > 3) { p.x = tx; p.z = tz; p.y = oy; } p.yaw = angLerp(p.yaw, Math.atan2(dx, dz), 1 - Math.exp(-8 * dt)); }
      if (d > 8) { p.x = ox; p.z = oz; p.y = oy; }
      p.hop = Math.max(0, p.hop - dt);
      const hop = (d > 0.3 ? Math.abs(Math.sin(this.t * 10 + p.id.length)) * 0.12 : 0) + Math.sin(p.hop * 10) * p.hop * 0.6;
      p.mesh.position.set(p.x, p.y + hop, p.z); p.mesh.rotation.y = p.yaw;
      const shiny = this.cur instanceof Overworld ? this.cur.sniffMark() : null;
      if (shiny && Math.random() < dt * 6) this.sparks.burst(shiny.x, heightGuess(this.cur, shiny.x, shiny.z), shiny.z, 1, 0xfff0b0, 0.3, 1.2, 0.3, 0.8);
    }
    // the owner's phone sends its pet off to sniff now and then
    const mine = this.pets.filter((p) => p.owner === this.me);
    if (mine.length && this.cur instanceof Overworld && (this.sniffT -= dt) <= 0) {
      this.sniffT = 55 + Math.random() * 35;
      const p = mine[Math.floor(Math.random() * mine.length)], a = Math.random() * 6.28;
      const tx = this.player.x + Math.cos(a) * 5, tz = this.player.z + Math.sin(a) * 5;
      if (this.cur.ground(tx, tz, 5) !== null && now) p.target = [tx, tz];
    }
  }

  private partnerCompass() {
    const ps = this.pSnap, alive = !!ps && performance.now() - this.pSeen < 20_000;
    if (!alive || ps!.s !== this.cur.kind) return { pBiome: null, pArrow: null, pDist: 0 };
    const dx = ps!.p[0] - this.player.x, dz = ps!.p[2] - this.player.z, d = Math.hypot(dx, dz);
    const sx = dx * Math.cos(YAW) - dz * Math.sin(YAW), up = -dx * Math.sin(YAW) - dz * Math.cos(YAW);
    const pb = this.cur instanceof Overworld ? biomeOf(ps!.p[0], ps!.p[2]) : null;
    return { pBiome: pb, pArrow: d > 13 ? Math.round((Math.atan2(-up, sx) * 180) / Math.PI / 5) * 5 : null, pDist: Math.round(d) };
  }
  private emitHud() {
    const ps = this.pSnap, partnerScene = ps && performance.now() - this.pSeen < 20_000 ? ps.s : null;
    const c = this.ctx;
    const h: HudState = {
      ctx: c ? { label: c.label, icon: c.icon, tint: c.id.startsWith('held:') && !['held:gift', 'held:hammer', 'held:brush'].includes(c.id) ? item(this.heldId).tint : undefined,
        locked: (c.needs && !this.toolFor(c.needs)) || (c.minTier && c.tool && this.tier(c.tool) < c.minTier) ? '🔒' : undefined } : null,
      love: Math.round(this.love * 100) / 100, near: this.them.root.visible && Math.hypot(this.pPos.x - this.player.x, this.pPos.z - this.player.z) < 2.8,
      scene: this.cur.kind, holding: !!this.holdingWho, partnerScene, fps: this.fps, calls: this.renderer.info.render.calls, link: this.net.mode, dpr: this.dpr,
      synergy: this.synergy() > 1, moment: !!this.moment,
      biome: this.cur instanceof Overworld ? this.cur.biome : null, held: this.heldId,
      buffs: this.buffs.filter((b) => b.until > performance.now()).map((b) => ({ b: b.b, left: Math.ceil((b.until - performance.now()) / 10000) * 10 })),
      tri: this.renderer.info.render.triangles,
      ...this.partnerCompass(),
    };
    const key = JSON.stringify(h);
    if (key !== this.lastHud) { this.lastHud = key; this.o.onHud(h); }
  }

  dispose() {
    this.alive = false; cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize); window.removeEventListener('keydown', this.kd); window.removeEventListener('keyup', this.ku);
    this.net.close();
    this.cur.scene.remove(...this.owned());
    this.cur.dispose(); this.mine.dispose(); this.them.dispose();
    this.pets.forEach((p) => p.mesh.geometry.dispose());
    [this.sparks.points, this.hearts.points, this.tether, this.shadows.mesh].forEach((o: any) => { o.geometry.dispose(); o.material.dispose(); });
    this.bubbles.forEach((b) => b.el.remove()); this.pops.forEach((p) => p.el.remove());
    this.parcels.forEach((p) => p.mesh.geometry.dispose());
    this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}

const heightGuess = (s: SceneAPI, x: number, z: number) => (s.ground(x, z, 10) ?? 0) + 0.2;
