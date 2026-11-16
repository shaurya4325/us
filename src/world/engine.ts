// The game engine: one renderer, one live scene at a time (Overworld XOR Interior), fixed 45° iso camera rig,
// camera-relative joystick movement, partner interpolation, pets, love meter, couple actions and adaptive resolution.
import * as THREE from 'three';
import { Chibi, petMesh, type Anim } from './chibi';
import { Overworld } from './overworld';
import { Interior } from './interior';
import { Net, type Act, type Snap } from './net';
import { Particles, Shadows, heartTex, softDot, mat } from './gfx';
import { PETS, TOOLS, RES_ICON, type PetId, type ToolId, type Res } from './catalog';
import type { EngineAPI, Interactable, SceneAPI, WorldDoc } from './types';
import { PEOPLE, CAPES, type Who } from '../config/people';
import { sound } from './sound';

export interface HudState {
  ctx: { label: string; icon: string; locked?: string } | null;
  love: number; near: boolean; scene: 'over' | 'inside'; holding: boolean;
  partnerScene: 'over' | 'inside' | null; fps: number; calls: number; link: 'p2p' | 'cloud'; dpr: number; synergy: boolean;
}
export interface EngineOpts {
  canvas: HTMLCanvasElement; overlay: HTMLElement; fade: HTMLElement;
  me: Who; base: string; world: WorldDoc;
  patch: (fields: Record<string, any>, incs?: Record<string, number>) => void;
  onHud: (h: HudState) => void; onUi: (panel: string, data?: any) => void;
  toast: (title: string, body?: string) => void;
  onCouple: (kind: string, from: Who) => void;
}

const YAW = Math.PI / 4, PITCH = THREE.MathUtils.degToRad(42), FOV = 30;
const angLerp = (a: number, b: number, k: number) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

interface Pet { id: PetId; owner: Who; mesh: THREE.Mesh; x: number; z: number; y: number; yaw: number; hop: number; target: [number, number] | null }

export class Engine implements EngineAPI {
  me: Who; partner: Who; world: WorldDoc;
  player = { x: 0, y: 0, z: 0 };
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
  private love = 0; private holding: Who | null = null; private lastHarvest = 0; private pHarvest = 0;
  private timeScale = 1; private stopUntil = 0; private shakeA = 0;
  private camTarget = new THREE.Vector3(); private camOff = new THREE.Vector3(); private look = new THREE.Vector3();
  private v1 = new THREE.Vector3(); private v2 = new THREE.Vector3();
  private t = 0; private last = performance.now(); private raf = 0; private alive = true; private fading = false;
  private fpsT = 0; private frames = 0; private fps = 60; private dpr: number; private maxDpr: number; private goodFor = 0;
  private hudT = 0; private lastHud = ''; private sendT = 0; private stepT = 0; private heartT = 0; private sniffT = 0;
  private ctx: Interactable | null = null; private bubbles: { el: HTMLDivElement; who: Who; until: number }[] = [];
  private pops: { el: HTMLDivElement; x: number; y: number; z: number; t: number }[] = [];

  constructor(o: EngineOpts) {
    this.o = o; this.me = o.me; this.partner = o.me === 'shaurya' ? 'arushi' : 'shaurya'; this.world = o.world;
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
    this.tetherPos = new Float32Array(20 * 3);
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(this.tetherPos, 3));
    this.tether = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xffb3d4, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tether.frustumCulled = false;
    this.net = new Net(o.base, o.me);
    this.net.onSnap = (s) => { this.pSnap = s; this.pSeen = performance.now(); };
    this.net.onAct = (a) => this.onAct(a);
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
    this.pets.forEach((p) => { p.x = x + (Math.random() - 0.5) * 2; p.z = z + 1; p.y = y; });
    this.camTarget.set(x, y, z);
  }
  private swap(make: () => SceneAPI) {
    if (this.fading) return;
    this.fading = true;
    const f = this.o.fade; f.style.opacity = '1'; sound('door');
    setTimeout(() => {
      if (!this.alive) return;
      const old = this.cur;
      old.scene.remove(...this.owned());
      old.dispose(); this.renderer.renderLists.dispose();      // the outside world is fully unloaded
      this.mount(make());
      this.renderer.compile(this.cur.scene, this.camera);
      requestAnimationFrame(() => { f.style.opacity = '0'; setTimeout(() => (this.fading = false), 350); });
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
  setJoy(x: number, y: number) { this.joy.set(x, y); if ((x || y) && this.holding && this.holding !== this.me) this.holding = null; }
  jump() { if (this.grounded) { this.vy = 7.2; this.grounded = false; sound('jump'); } }
  private kd = (e: KeyboardEvent) => { this.keys.add(e.key.toLowerCase()); if (e.key === ' ') this.jump(); if (e.key.toLowerCase() === 'e') this.interact(); };
  private ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private resize = () => {
    const c = this.o.canvas, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight;
    this.renderer.setPixelRatio(this.dpr); this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  };

  interact() {
    const c = this.ctx; if (!c || this.fading) return;
    if (c.needs && !this.toolFor(c.needs)) { this.toast(`${TOOLS[c.needs].icon} You need the ${TOOLS[c.needs].name}`, 'Craft it at the bench near the house plot'); return; }
    if (c.id.startsWith('pet:')) return this.petPet(c.id.slice(4) as PetId);
    if (c.id === 'plant') {
      if ((this.world.inv?.flower ?? 0) < 1) { this.toast('🌼 Need 1 flower to plant a sapling'); return; }
      const id = 'p' + Date.now().toString(36);
      this.patch({ [`planted.${id}`]: { x: this.player.x, z: this.player.z + 0.8, at: Date.now(), by: this.me } }, { 'inv.flower': -1 });
      this.play('pat', 0.6); this.fx('leaf', this.player.x, this.player.y + 0.3, this.player.z + 0.8, 12); sound('pick');
      return;
    }
    this.cur.interact(c.id, this);
  }

  couple(kind: string, text = '') {
    const t = Date.now();
    if (kind === 'hands') { this.holding = this.holding ? null : this.me; this.net.act({ k: 'couple', t, d: { kind, on: !!this.holding } }); }
    else if (kind === 'whisper') { this.net.act({ k: 'whisper', t, d: { text } }); this.bubble(this.me, text); return; }
    else this.net.act({ k: 'couple', t, d: { kind } });
    this.coupleFx(kind, this.me);
  }
  private coupleFx(kind: string, from: Who) {
    const anim: Record<string, Anim> = { kiss: 'kiss', hug: 'hug', dance: 'dance', pat: from === this.me ? 'pat' : 'idle', hands: 'hands' };
    const secs = kind === 'dance' ? 3 : kind === 'hands' ? 0 : 2.2;
    if (secs) this.play(anim[kind] ?? 'idle', secs);
    // face each other
    if (kind !== 'dance') this.yaw = Math.atan2(this.pPos.x - this.player.x, this.pPos.z - this.player.z);
    const mx = (this.player.x + this.pPos.x) / 2, mz = (this.player.z + this.pPos.z) / 2, my = Math.max(this.player.y, this.pPos.y) + 1.6;
    this.hearts.burst(mx, my, mz, kind === 'kiss' ? 22 : 14, kind === 'kiss' ? 0xff3e8a : 0xffb3d4, 1.2, 1.6, 0.5, 1.6, false);
    sound(kind === 'kiss' ? 'kiss' : kind === 'hug' ? 'hug' : 'shimmer');
    this.o.onCouple(kind, from);
  }
  private onAct(a: Act) {
    if (a.k === 'couple') {
      if (a.d.kind === 'hands') this.holding = a.d.on ? this.partner : null;
      this.coupleFx(a.d.kind, this.partner);
    }
    if (a.k === 'whisper') { this.bubble(this.partner, a.d.text); sound('pop'); }
    if (a.k === 'harvest') this.pHarvest = Date.now();
    if (a.k === 'petted') { const p = this.pets.find((x) => x.id === a.d.id); if (p) { p.hop = 0.6; this.hearts.burst(p.x, p.y + 0.8, p.z, 6, 0xff9ec4, 0.6, 1, 0.35, 1.2, false); } }
  }
  private petPet(id: PetId) {
    const p = this.pets.find((x) => x.id === id); if (!p) return;
    p.hop = 0.6; this.play('pat', 1); sound('squeak');
    this.hearts.burst(p.x, p.y + 0.8, p.z, 8, 0xff9ec4, 0.6, 1, 0.35, 1.2, false);
    this.net.act({ k: 'petted', t: Date.now(), d: { id } });
    this.patch({}, { [`stats.pet_${id}`]: 1 });
  }

  /* ---------- EngineAPI for scenes ---------- */
  now = () => Date.now();
  toolFor = (t?: ToolId) => !t || !!this.world.tools?.[t];
  synergy = () => (Date.now() - this.pHarvest < 5000 && this.pPos.distanceTo(this.v1.set(this.player.x, this.player.y, this.player.z)) < 7 && this.pSnap?.s === this.cur.kind ? 2 : 1);
  patch = (f: Record<string, any>, i: Record<string, number> = {}) => this.o.patch(f, i);
  give = (res: Record<string, number>, x: number, y: number, z: number) => {
    const inc: Record<string, number> = {};
    for (const k in res) { inc[`inv.${k}`] = res[k]; inc[`stats.${k}`] = res[k]; }
    this.patch({}, inc);
    this.popup(Object.entries(res).map(([k, v]) => `+${v} ${RES_ICON[k as Res]}`).join(' ') + (this.synergy() > 1 ? ' ✦2×' : ''), x, y, z);
    sound('collect'); this.lastHarvest = Date.now();
    this.net.act({ k: 'harvest', t: Date.now() });
  };
  fx = (kind: string, x: number, y: number, z: number, n = 12) => {
    const C: Record<string, [number, number, number, number, boolean, Particles]> = {
      leaf: [0x8fd694, 1.6, 2.4, 0.3, true, this.sparks], blossom: [0xffb7d0, 1.6, 2.2, 0.3, true, this.sparks], spark: [0xfff0b0, 1.2, 2.5, 0.28, true, this.sparks],
      stone: [0xd8d2e6, 1.5, 2.6, 0.25, true, this.sparks], crystal: [0xff7db5, 1.4, 3, 0.35, true, this.sparks], splash: [0x9ef0ea, 1.2, 3.2, 0.3, true, this.sparks],
      gold: [0xffd27a, 1.0, 2.8, 0.32, true, this.sparks], heart: [0xff7db5, 0.8, 1.4, 0.45, false, this.hearts],
    };
    const c = C[kind] ?? C.spark;
    c[5].burst(x, y, z, n, c[0], c[1], c[2], c[3], 0.9, c[4]);
    if (this.synergy() > 1 && kind !== 'heart') this.sparks.burst(x, y + 0.3, z, 8, 0xffffff, 0.8, 1.5, 0.4, 1.2, false);
  };
  sound = (s: string) => sound(s);
  ui = (p: string, d?: any) => this.o.onUi(p, d);
  toast = (a: string, b?: string) => this.o.toast(a, b);
  swing = () => { this.mine.swing(); sound('swoosh'); };
  hitStop = (ms: number) => { this.stopUntil = performance.now() + ms; };
  shake = (a: number) => { this.shakeA = Math.max(this.shakeA, a); };
  play = (a: string, secs: number) => { this.animOverride = a as Anim; this.animUntil = performance.now() + secs * 1000; };

  /* ---------- DOM overlays (speech bubbles, +resource popups) ---------- */
  private bubble(who: Who, text: string) {
    const el = document.createElement('div'); el.className = 'bubble'; el.textContent = text;
    this.o.overlay.appendChild(el); this.bubbles.push({ el, who, until: performance.now() + 4200 });
  }
  private popup(text: string, x: number, y: number, z: number) {
    const el = document.createElement('div'); el.className = 'popup'; el.textContent = text;
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
    let jx = this.joy.x, jy = this.joy.y;
    if (this.keys.size) { jx += (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0); jy += (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) - (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0); }
    const fwdX = -Math.sin(YAW), fwdZ = -Math.cos(YAW), rgtX = Math.cos(YAW), rgtZ = -Math.sin(YAW);
    let mx = rgtX * jx + fwdX * -jy, mz = rgtZ * jx + fwdZ * -jy;
    const mag = Math.min(1, Math.hypot(jx, jy));
    // holding hands: the follower drifts to the leader's side while idle
    if (this.holding === this.partner && mag < 0.05 && this.pSnap?.s === S.kind) {
      const tx = this.pPos.x + Math.cos(this.pYaw) * 0.75, tz = this.pPos.z - Math.sin(this.pYaw) * 0.75, d = Math.hypot(tx - P.x, tz - P.z);
      if (d > 0.25) { mx = (tx - P.x) / d; mz = (tz - P.z) / d; }
    }
    const ml = Math.hypot(mx, mz), swimming = S instanceof Interior && S.inPool(P.x, P.z, P.y);
    const speed = (swimming ? 2.4 : 4.4) * (ml > 0.01 ? Math.max(mag, this.holding === this.partner && mag < 0.05 ? 0.8 : 0) : 0);
    const tvx = ml > 0.01 ? (mx / ml) * speed : 0, tvz = ml > 0.01 ? (mz / ml) * speed : 0;
    const acc = 1 - Math.exp(-14 * dt);
    this.vel.x += (tvx - this.vel.x) * acc; this.vel.y += (tvz - this.vel.y) * acc;
    const g0 = S.ground(P.x, P.z, P.y) ?? P.y;
    const tryMove = (nx: number, nz: number) => {
      const g = S.ground(nx, nz, P.y);
      if (g === null) return false;
      if (this.grounded && g < g0 - 1.0) return false;
      P.x = nx; P.z = nz; return true;
    };
    if (!tryMove(P.x + this.vel.x * dt, P.z)) this.vel.x = 0;
    if (!tryMove(P.x, P.z + this.vel.y * dt)) this.vel.y = 0;
    // vertical
    const g = S.ground(P.x, P.z, P.y) ?? g0;
    this.vy -= 22 * dt; P.y += this.vy * dt;
    if (P.y <= g) { if (!this.grounded && this.vy < -4) { sound('land'); this.sparks.burst(P.x, g + 0.05, P.z, 6, 0xffffff, 0.8, 0.6, 0.25, 0.4); } P.y = g; this.vy = 0; this.grounded = true; }
    else if (P.y - g > 0.08) this.grounded = false;
    if (this.grounded && P.y - g < 0.5) P.y = g;
    const spd = Math.hypot(this.vel.x, this.vel.y);
    if (spd > 0.3) this.yaw = angLerp(this.yaw, Math.atan2(this.vel.x, this.vel.y), 1 - Math.exp(-12 * dt));
    // my chibi
    const over = this.animOverride && now < this.animUntil ? this.animOverride : null;
    if (over && spd > 0.8 && over !== 'hands') this.animOverride = null;
    const anim: Anim = swimming ? 'swim' : over ?? (this.holding ? 'hands' : spd > 0.3 ? 'walk' : 'idle');
    this.mine.play(anim); this.mine.speed = spd;
    this.mine.root.position.set(P.x, P.y, P.z); this.mine.root.rotation.y = this.yaw;
    this.mine.update(dt, !this.grounded);
    // auto-equip the tool the context action needs
    const want = this.ctx?.tool && this.toolFor(this.ctx.tool) ? this.ctx.tool : (anim === 'cast' ? 'rod' : 'none');
    this.mine.setTool(want as ToolId);
    if (spd > 1 && this.grounded && (this.stepT -= dt) <= 0) { this.stepT = swimming ? 0.6 : 0.3; sound(swimming ? 'swim' : S.kind === 'over' ? 'step' : 'stepWood'); }
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
      this.them.setTool(ps.tl as ToolId);
      this.them.root.position.copy(this.pPos); this.them.root.rotation.y = this.pYaw;
      this.them.update(dt, ps.p[1] - (S.ground(ps.p[0], ps.p[2], ps.p[1]) ?? ps.p[1]) > 0.15);
      void this.pAirY;
    }
    // send my snapshot
    if ((this.sendT -= dt) <= 0) { this.sendT = 0.1; this.net.send({ p: [P.x, P.y, P.z], r: this.yaw, a: anim, tl: want, s: S.kind, v: spd, t: Date.now() }); }
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
    // context action: nearest interactable in reach
    let best: Interactable | null = null, bd = 1e9;
    const list = S.interactables(P.x, P.z);
    for (const p of this.pets) if (p.mesh.visible) list.push({ id: 'pet:' + p.id, x: p.x, z: p.z, r: 1.3, label: `Pet ${PETS[p.id].name}`, icon: PETS[p.id].icon });
    for (const it of list) {
      if (it.y !== undefined && Math.abs(it.y - P.y) > 1.6) continue;
      const d = Math.hypot(it.x - P.x, it.z - P.z);
      if (d < it.r && d < bd) { bd = d; best = it; }
    }
    if (!best && S instanceof Overworld && this.toolFor('can') && S.plantAt(P.x, P.z + 0.8)) best = { id: 'plant', x: P.x, z: P.z, r: 1, label: 'Plant sapling (1🌼)', icon: '🌱', tool: 'can' };
    this.ctx = best;
    // scene + particles
    S.update(dt, this.t, this);
    this.sparks.update(dt); this.hearts.update(dt);
    // camera: exponential spring follow with look-ahead, fixed 45° yaw / 42° pitch
    const D = S.kind === 'over' ? 23 : 21;
    this.look.set(P.x + this.vel.x * 0.35, P.y + 0.6, P.z + this.vel.y * 0.35);
    this.camTarget.lerp(this.look, 1 - Math.exp(-8 * dt));
    this.camOff.set(Math.sin(YAW) * Math.cos(PITCH) * D, Math.sin(PITCH) * D, Math.cos(YAW) * Math.cos(PITCH) * D);
    this.camera.position.copy(this.camTarget).add(this.camOff);
    if (this.shakeA > 0.001) { this.camera.position.x += (Math.random() - 0.5) * this.shakeA; this.camera.position.y += (Math.random() - 0.5) * this.shakeA; this.shakeA *= Math.exp(-14 * dt); }
    this.camera.lookAt(this.camTarget);
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

  private emitHud() {
    const ps = this.pSnap, partnerScene = ps && performance.now() - this.pSeen < 20_000 ? ps.s : null;
    const c = this.ctx;
    const h: HudState = {
      ctx: c ? { label: c.label, icon: c.icon, locked: c.needs && !this.toolFor(c.needs) ? TOOLS[c.needs].icon : undefined } : null,
      love: Math.round(this.love * 100) / 100, near: this.them.root.visible && Math.hypot(this.pPos.x - this.player.x, this.pPos.z - this.player.z) < 2.8,
      scene: this.cur.kind, holding: !!this.holding, partnerScene, fps: this.fps, calls: this.renderer.info.render.calls, link: this.net.mode, dpr: this.dpr,
      synergy: this.synergy() > 1,
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
    this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}

const heightGuess = (s: SceneAPI, x: number, z: number) => (s.ground(x, z, 10) ?? 0) + 0.2;
