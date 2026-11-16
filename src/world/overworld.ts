// OverworldScene: a compact 38×38 pastel-emerald island framed by clouds. Everything repeated is instanced.
import * as THREE from 'three';
import { Kit, mat, basic, windy, waterMaterial, skyTexture, softDot, labelSprite, rand, disposeTree } from './gfx';
import { CABLE_COST, ROOMS, canAfford, costText, negate, type RoomCell } from './catalog';
import type { EngineAPI, Interactable, SceneAPI, WorldDoc } from './types';
import type { Who } from '../config/people';

export const HALF = 19;
const POND = { x: -6, z: 5, r: 3.3 };
const PLOT = { x: 5.5, z: -4.5 };            // starter room cell (0,0) centre
const CELL = 4;                               // exterior cottage block size
const HOPPER = { x: -2.4, z: 1.4 };
const BENCH = { x: -3.8, z: -2.4 };
const NEST = { x: -10.5, z: -8.5 };
const ANCHORS = [
  { id: 'west', x: -12.5, z: -2, res: 'wood', label: 'West Birch Grove' },
  { id: 'east', x: 12.5, z: 4.5, res: 'wood', label: 'East Cherry Grove' },
  { id: 'quarry', x: 2, z: -12.5, res: 'stone', label: 'Rose Quarry' },
] as const;

const superR = (x: number, z: number) => Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25);
export function heightAt(x: number, z: number) {
  let h = 0.28 * Math.sin(x * 0.33 + 0.4) * Math.cos(z * 0.29) + 0.22 * Math.sin((x + z) * 0.19 + 1.3) + 0.12 * Math.cos(x * 0.71 - z * 0.53);
  h = h * 0.9 + 0.25;
  const pd = Math.hypot(x - POND.x, z - POND.z);
  if (pd < POND.r + 1.6) h = THREE.MathUtils.lerp(-0.55, h, THREE.MathUtils.smoothstep(pd, POND.r - 0.6, POND.r + 1.6));
  const pl = Math.hypot(x - PLOT.x, z - PLOT.z);
  if (pl < 9) h = THREE.MathUtils.lerp(0.3, h, THREE.MathUtils.smoothstep(pl, 5, 9));   // flatten the house plot
  const r = superR(x, z);
  if (r > 16) h -= Math.pow((r - 16) / 3.2, 2) * 3.2;
  return h;
}
export const cellPos = (c: { gx: number; gz: number }) => [PLOT.x + c.gx * CELL, PLOT.z + c.gz * CELL] as const;

interface Node { id: string; kind: 'birch' | 'cherry' | 'rock' | 'crystal' | 'flower' | 'planted'; x: number; z: number; y: number; s: number; idx: number; hp: number; wob: number }

export class Overworld implements SceneAPI {
  kind = 'over' as const;
  scene = new THREE.Scene();
  private uTime = { value: 0 };
  private nodes: Node[] = [];
  private trunks!: THREE.InstancedMesh; private crowns!: THREE.InstancedMesh; private stumps!: THREE.InstancedMesh;
  private rocks!: THREE.InstancedMesh; private crystals!: THREE.InstancedMesh; private patches!: THREE.InstancedMesh;
  private clouds!: THREE.InstancedMesh; private cloudBase: { x: number; y: number; z: number; s: number; p: number }[] = [];
  private flies!: THREE.InstancedMesh; private bugs: { x: number; y: number; z: number; a: number; cx: number; cz: number; gone: number }[] = [];
  private koi!: THREE.InstancedMesh;
  private house = new THREE.Group(); private door: THREE.Mesh | null = null; private doorPos: [number, number] | null = null;
  private blocks: { x: number; z: number; h: number }[] = [];
  private cableLines: THREE.LineSegments | null = null; private packets!: THREE.InstancedMesh; private cableIds: string[] = [];
  private world: WorldDoc = {};
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private v = new THREE.Vector3(); private s3 = new THREE.Vector3(); private e = new THREE.Euler();
  private lastIncome = 0; private refT = 0; private sniffs: { x: number; z: number; until: number }[] = [];

  constructor() {
    const S = this.scene;
    S.background = skyTexture();
    S.fog = new THREE.Fog(0xe9f4f0, 30, 62);
    this.buildGround(); this.buildWater(); this.buildNodes(); this.buildDecor(); this.buildClouds(); this.buildLife();
    S.add(this.house);
    const pk = new Kit().ball(0.14, 0xfff0c8).build();
    this.packets = new THREE.InstancedMesh(pk, basic(0xffffff, { vertexColors: true }), 12);
    this.packets.frustumCulled = false; S.add(this.packets);
  }

  private buildGround() {
    const N = 64, geo = new THREE.PlaneGeometry(HALF * 2 + 4, HALF * 2 + 4, N, N);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), r = rand(7);
    const g1 = new THREE.Color(0x7ec88b), g2 = new THREE.Color(0x99df9e), sand = new THREE.Color(0xf3e3b5), cliff = new THREE.Color(0xd7c3a8);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = heightAt(x, z);
      p.setY(i, h);
      c.copy(g1).lerp(g2, 0.5 + 0.5 * Math.sin(x * 0.4 + z * 0.3) * Math.cos(z * 0.2) + (r() - 0.5) * 0.15);
      const pd = Math.hypot(x - POND.x, z - POND.z);
      if (pd < POND.r + 0.9) c.lerp(sand, THREE.MathUtils.smoothstep(POND.r + 0.9 - pd, 0, 0.9));
      if (h < -0.2 && pd > POND.r + 1.5) c.lerp(cliff, Math.min(1, -h / 1.5));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    this.scene.add(new THREE.Mesh(geo, mat()));
    // grass tufts: 1 instanced draw with wind
    const tuft = new Kit();
    for (let k = 0; k < 3; k++) tuft.add(new THREE.ConeGeometry(0.045, 0.34, 3), 0xffffff, Math.cos(k * 2.1) * 0.05, 0.17, Math.sin(k * 2.1) * 0.05, 0.15 * Math.cos(k * 2.1), 0, 0.15 * Math.sin(k * 2.1));
    const gm = windy(mat(), this.uTime, 0.35), NG = 1700;
    const grass = new THREE.InstancedMesh(tuft.build(), gm, NG);
    const gc = new THREE.Color();
    let n = 0;
    for (let tries = 0; n < NG && tries < NG * 3; tries++) {
      const x = (r() - 0.5) * 33, z = (r() - 0.5) * 33;
      if (superR(x, z) > 16 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.5) continue;
      const s = 0.7 + r() * 0.8;
      this.m4.compose(this.v.set(x, heightAt(x, z), z), this.q.setFromEuler(this.e.set(0, r() * 6, 0)), this.s3.set(s, s, s));
      grass.setMatrixAt(n, this.m4);
      grass.setColorAt(n++, gc.setHSL(0.33 + r() * 0.06, 0.45, 0.48 + r() * 0.14));
    }
    grass.count = n;
    this.scene.add(grass);
    // decorative glowing wildflowers (yellow, pink, white)
    const fl = new Kit().cyl(0.012, 0.012, 0.22, 0x5aa86a).ball(0.06, 0xffffff, 0, 0.24, 0, 1, 0.7, 1, 0).build();
    const flowers = new THREE.InstancedMesh(fl, windy(mat(), this.uTime, 0.25), 520);
    const fcols = [0xfff07a, 0xff9ec4, 0xffffff, 0xffc94a, 0xff6fa8];
    const glowPos: number[] = [], glowCol: number[] = [];
    n = 0;
    for (let tries = 0; n < 520 && tries < 3000; tries++) {
      // clustered patches
      const cx = Math.round((r() - 0.5) * 6) * 5, cz = Math.round((r() - 0.5) * 6) * 5;
      const x = cx + (r() - 0.5) * 5, z = cz + (r() - 0.5) * 5;
      if (superR(x, z) > 15.8 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.6 || Math.hypot(x - PLOT.x, z - PLOT.z) < 5) continue;
      const s = 0.8 + r() * 0.7, y = heightAt(x, z);
      this.m4.compose(this.v.set(x, y, z), this.q.identity(), this.s3.set(s, s, s));
      flowers.setMatrixAt(n, this.m4);
      const fc = fcols[Math.floor(r() * fcols.length)];
      flowers.setColorAt(n++, gc.set(fc));
      if (r() < 0.22) { glowPos.push(x, y + 0.3 * s, z); gc.set(fc); glowCol.push(gc.r, gc.g, gc.b); }
    }
    flowers.count = n;
    this.scene.add(flowers);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(glowPos, 3));
    gg.setAttribute('color', new THREE.Float32BufferAttribute(glowCol, 3));
    const glow = new THREE.Points(gg, new THREE.PointsMaterial({ size: 0.5, map: softDot(), vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.scene.add(glow);
  }

  private buildWater() {
    const w = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 0.25, 40), waterMaterial(this.uTime));
    w.rotation.x = -Math.PI / 2; w.position.set(POND.x, -0.1, POND.z);
    this.scene.add(w);
    const k = new Kit().ball(0.12, 0xff8a3d, 0, 0, 0, 0.7, 0.45, 1.6).add(new THREE.ConeGeometry(0.08, 0.14, 4), 0xffffff, 0, 0, -0.22, Math.PI / 2);
    this.koi = new THREE.InstancedMesh(k.build(), mat(), 5);
    this.koi.frustumCulled = false; this.scene.add(this.koi);
  }

  private buildNodes() {
    const r = rand(42), list: Node[] = [];
    const free = (x: number, z: number, d: number) => superR(x, z) < 15 && Math.hypot(x - POND.x, z - POND.z) > POND.r + 1.4 && Math.hypot(x - PLOT.x, z - PLOT.z) > 8.5
      && Math.hypot(x, z - 6) > 3 && Math.hypot(x - NEST.x, z - NEST.z) > 2.2 && Math.hypot(x - HOPPER.x, z - HOPPER.z) > 2.2 && Math.hypot(x - BENCH.x, z - BENCH.z) > 2
      && ANCHORS.every((a) => Math.hypot(x - a.x, z - a.z) > 1.8) && list.every((n) => Math.hypot(n.x - x, n.z - z) > d);
    const place = (kind: Node['kind'], cx: number, cz: number, spread: number, count: number, d: number, prefix: string) => {
      for (let i = 0, tries = 0; i < count && tries < 400; tries++) {
        const x = cx + (r() - 0.5) * spread, z = cz + (r() - 0.5) * spread;
        if (!free(x, z, d)) continue;
        list.push({ id: prefix + list.filter((n) => n.kind === kind).length, kind, x, z, y: heightAt(x, z), s: 0.85 + r() * 0.4, idx: 0, hp: 0, wob: 0 }); i++;
      }
    };
    place('birch', -11, -1, 8, 9, 1.7, 'b'); place('cherry', 11, 5, 8, 9, 1.7, 'c');
    place('birch', -2, 13, 10, 3, 1.7, 'b'); place('cherry', 6, 12, 8, 3, 1.7, 'c');
    place('rock', 2, -12, 9, 7, 1.4, 'r'); place('rock', -13, 9, 5, 3, 1.4, 'r');
    place('crystal', 5, -13, 7, 4, 1.4, 'x'); place('crystal', 13, -6, 4, 2, 1.4, 'x');
    place('flower', -4, -9, 8, 3, 2, 'f'); place('flower', 10, -1, 6, 2, 2, 'f'); place('flower', -9, 12, 5, 2, 2, 'f');
    this.nodes = list;
    const trees = list.filter((n) => n.kind === 'birch' || n.kind === 'cherry').length + 20;  // +20 planted saplings
    const trunk = new Kit().cyl(0.11, 0.17, 1.3, 0xffffff).build();
    const crown = new Kit().ball(0.75, 0xffffff, 0, 1.75, 0, 1, 0.85, 1, 1).ball(0.55, 0xffffff, 0.45, 1.45, 0.2, 1, 0.85, 1, 1).ball(0.5, 0xffffff, -0.4, 1.5, -0.15, 1, 0.85, 1, 1).build();
    this.trunks = new THREE.InstancedMesh(trunk, mat(), trees);
    this.crowns = new THREE.InstancedMesh(crown, windy(mat(), this.uTime, 0.05), trees);
    this.stumps = new THREE.InstancedMesh(new Kit().cyl(0.17, 0.2, 0.22, 0xb98a63).cyl(0.15, 0.15, 0.02, 0xf2d6b0, 0, 0.22).build(), mat(), trees);
    const rock = new Kit().add(new THREE.DodecahedronGeometry(0.55, 0), 0xc9c3d6, 0, 0.3, 0, 0, 0, 0, 1.2, 0.8, 1).add(new THREE.DodecahedronGeometry(0.3, 0), 0xb7b0c8, 0.5, 0.15, 0.2).build();
    this.rocks = new THREE.InstancedMesh(rock, mat(), list.filter((n) => n.kind === 'rock').length);
    const xtal = new Kit().add(new THREE.OctahedronGeometry(0.32, 0), 0xff7db5, 0, 0.55, 0, 0, 0, 0, 0.7, 1.6, 0.7).add(new THREE.OctahedronGeometry(0.2, 0), 0xffb3d4, 0.3, 0.3, 0.1, 0, 0, 0.5, 0.7, 1.4, 0.7)
      .add(new THREE.OctahedronGeometry(0.18, 0), 0xf5a3c7, -0.25, 0.25, -0.1, 0, 0, -0.4, 0.7, 1.4, 0.7).add(new THREE.DodecahedronGeometry(0.3, 0), 0xb7b0c8, 0, 0.05, 0, 0, 0, 0, 1.3, 0.4, 1.3).build();
    this.crystals = new THREE.InstancedMesh(xtal, mat(), list.filter((n) => n.kind === 'crystal').length);
    const patch = new Kit();
    for (let i = 0; i < 7; i++) patch.cyl(0.015, 0.015, 0.3, 0x5aa86a, Math.cos(i) * 0.35, 0, Math.sin(i * 1.7) * 0.35).ball(0.1, [0xff7db5, 0xfff07a, 0xffffff][i % 3], Math.cos(i) * 0.35, 0.32, Math.sin(i * 1.7) * 0.35, 1, 0.7, 1, 0);
    this.patches = new THREE.InstancedMesh(patch.build(), windy(mat(), this.uTime, 0.3), list.filter((n) => n.kind === 'flower').length);
    const counters: Record<string, number> = {};
    for (const n of list) {
      const key = n.kind === 'birch' || n.kind === 'cherry' ? 'tree' : n.kind;
      n.idx = counters[key] = (counters[key] ?? -1) + 1;
    }
    // planted sapling slots after the fixed trees
    const tc = (counters.tree ?? -1) + 1;
    for (let i = 0; i < 20; i++) this.nodes.push({ id: '', kind: 'planted', x: 0, z: 0, y: 0, s: 0, idx: tc + i, hp: 0, wob: 0 });
    [this.trunks, this.crowns, this.stumps, this.rocks, this.crystals, this.patches].forEach((m) => this.scene.add(m));
    this.refreshNodes();
  }

  private refreshNodes() {
    const now = Date.now(), c = new THREE.Color();
    for (const n of this.nodes) {
      const down = (this.world.nodes?.[n.id] ?? 0) > now;
      const wob = n.wob > 0 ? Math.sin(n.wob * 40) * n.wob * 0.5 : 0;
      if (n.kind === 'birch' || n.kind === 'cherry' || n.kind === 'planted') {
        let s = n.s;
        if (n.kind === 'planted') {
          const p = this.world.planted?.[n.id];
          s = p && n.id ? Math.min(1, 0.25 + (now - p.at) / 90_000) * 0.9 : 0;
        }
        const live = s > 0 && !down;
        this.m4.compose(this.v.set(n.x, n.y, n.z), this.q.setFromEuler(this.e.set(wob * 0.3, n.x, wob * 0.3)), this.s3.setScalar(live ? s : 0.0001));
        this.trunks.setMatrixAt(n.idx, this.m4); this.crowns.setMatrixAt(n.idx, this.m4);
        const cherry = n.kind === 'cherry' || (n.kind === 'planted' && n.idx % 2 === 0);
        this.trunks.setColorAt(n.idx, c.set(cherry ? 0x9b6b55 : 0xf4f1ea));
        this.crowns.setColorAt(n.idx, c.set(cherry ? 0xffb7d0 : 0x8fd694).offsetHSL(0, 0, ((n.idx * 37) % 10) / 100 - 0.05));
        this.m4.compose(this.v.set(n.x, n.y, n.z), this.q.identity(), this.s3.setScalar(down && s > 0 ? n.s : 0.0001));
        this.stumps.setMatrixAt(n.idx, this.m4);
      } else {
        const mesh = n.kind === 'rock' ? this.rocks : n.kind === 'crystal' ? this.crystals : this.patches;
        this.m4.compose(this.v.set(n.x, n.y, n.z), this.q.setFromEuler(this.e.set(0, n.x * 3, wob * 0.4)), this.s3.setScalar(down ? 0.0001 : n.s));
        mesh.setMatrixAt(n.idx, this.m4);
      }
    }
    [this.trunks, this.crowns, this.stumps, this.rocks, this.crystals, this.patches].forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }

  private buildDecor() {
    const k = new Kit(), r = rand(9);
    // pond rim pebbles + lily pads
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, rr = POND.r + 0.25 + r() * 0.3, x = POND.x + Math.cos(a) * rr, z = POND.z + Math.sin(a) * rr;
      k.add(new THREE.DodecahedronGeometry(0.16 + r() * 0.12, 0), 0xe7e0ee, x, heightAt(x, z) + 0.03, z, r(), r(), 0, 1, 0.6, 1);
    }
    for (let i = 0; i < 5; i++) {
      const a = r() * 6.28, rr = r() * (POND.r - 0.8);
      k.add(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 10, 1, false, 0, 5.6), 0x7cc47f, POND.x + Math.cos(a) * rr, -0.06, POND.z + Math.sin(a) * rr);
      if (i % 2 === 0) k.ball(0.08, 0xffb3d4, POND.x + Math.cos(a) * rr, 0.0, POND.z + Math.sin(a) * rr, 1, 0.6, 1, 0);
    }
    // house plot: soft stone path + fence + sign
    for (let i = 0; i < 6; i++) { const x = PLOT.x - 0.4 * i, z = PLOT.z + 6.4 + i * 0.9; k.add(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 8), 0xf0e6dc, x, heightAt(x, z) + 0.02, z); }
    // crafting bench
    k.box(1.4, 0.55, 0.7, 0xc08a5e, BENCH.x, heightAt(BENCH.x, BENCH.z), BENCH.z).box(0.3, 0.2, 0.3, 0xb7b0c8, BENCH.x - 0.4, heightAt(BENCH.x, BENCH.z) + 0.55, BENCH.z)
      .box(0.5, 0.05, 0.12, 0xf2b8a0, BENCH.x + 0.3, heightAt(BENCH.x, BENCH.z) + 0.57, BENCH.z);
    // resource hopper (funnel on a crate)
    const hy = heightAt(HOPPER.x, HOPPER.z);
    k.box(1.1, 0.7, 1.1, 0xb98057, HOPPER.x, hy, HOPPER.z).add(new THREE.CylinderGeometry(0.75, 0.3, 0.6, 8, 1, true), 0xf5a3c7, HOPPER.x, hy + 1.0, HOPPER.z)
      .cyl(0.05, 0.05, 1.6, 0x8a5a3c, HOPPER.x + 0.5, hy, HOPPER.z + 0.5).ball(0.12, 0xfff07a, HOPPER.x + 0.5, hy + 1.7, HOPPER.z + 0.5);
    // pet nest: woven ring + fluffy cushions
    const ny = heightAt(NEST.x, NEST.z);
    k.add(new THREE.TorusGeometry(0.9, 0.28, 6, 14), 0xc79a6b, NEST.x, ny + 0.2, NEST.z, Math.PI / 2).ball(0.55, 0xfff1f6, NEST.x, ny + 0.15, NEST.z, 1.4, 0.4, 1.4)
      .ball(0.25, 0xffc6dc, NEST.x + 0.3, ny + 0.35, NEST.z - 0.2).ball(0.2, 0xcfe3ff, NEST.x - 0.3, ny + 0.33, NEST.z + 0.2);
    // cable anchor posts
    for (const a of ANCHORS) {
      const y = heightAt(a.x, a.z);
      k.cyl(0.12, 0.16, 2.4, 0x9a6a46, a.x, y, a.z).box(0.7, 0.1, 0.1, 0x9a6a46, a.x, y + 2.1, a.z).ball(0.16, 0xfff07a, a.x, y + 2.5, a.z, 1, 1, 1, 0);
    }
    this.scene.add(new THREE.Mesh(k.build(), mat()));
    // soft light shafts (Sky-like sun rays), additive and static
    const rays = new THREE.Mesh(new THREE.PlaneGeometry(3, 16), new THREE.MeshBasicMaterial({ color: 0xfff3d6, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    for (let i = 0; i < 4; i++) {
      const ray = rays.clone(); ray.position.set(-10 + i * 7, 6, -8 + i * 2); ray.rotation.set(0, Math.PI / 4, 0.5); this.scene.add(ray);
    }
    // labels
    const sign = labelSprite('Our House Plot', '#F5A3C7', 1.2, false); sign.position.set(PLOT.x + 3.2, 1.9, PLOT.z + 7); this.scene.add(sign);
  }

  private buildClouds() {
    const r = rand(77), N = 150;
    this.clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshMatcapMaterial({ matcap: mat().matcap!, color: 0xffffff }), N);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + r() * 0.05, rr = 19.5 + r() * 7, sq = 1 / Math.pow(Math.pow(Math.abs(Math.cos(a)), 4) + Math.pow(Math.abs(Math.sin(a)), 4), 0.25);
      this.cloudBase.push({ x: Math.cos(a) * rr * sq * 0.92, y: -2.6 + r() * 2.2, z: Math.sin(a) * rr * sq * 0.92, s: 1.6 + r() * 2.6, p: r() * 6 });
    }
    this.clouds.frustumCulled = false;
    this.scene.add(this.clouds);
  }

  private buildLife() {
    const r = rand(3);
    const wing = new Kit().add(new THREE.CircleGeometry(0.12, 6), 0xffffff, -0.1, 0, 0, -Math.PI / 2, 0, 0.3).add(new THREE.CircleGeometry(0.12, 6), 0xffffff, 0.1, 0, 0, -Math.PI / 2, 0, -0.3).build();
    this.flies = new THREE.InstancedMesh(wing, basic(0xffffff, { side: THREE.DoubleSide, vertexColors: true }), 10);
    const c = new THREE.Color(), cols = [0xffd27a, 0x9fd8ff, 0xff9ec4, 0xffffff, 0xb9a3e8];
    for (let i = 0; i < 10; i++) {
      const cx = (r() - 0.5) * 24, cz = (r() - 0.5) * 24;
      this.bugs.push({ x: cx, y: 1, z: cz, a: r() * 6, cx, cz, gone: 0 });
      this.flies.setColorAt(i, c.set(cols[i % cols.length]));
    }
    this.flies.frustumCulled = false;
    this.scene.add(this.flies);
  }

  private rebuildHouse() {
    disposeTree(this.house); this.house.clear();
    const rooms = Object.values(this.world.rooms ?? {}) as RoomCell[];
    this.blocks = []; this.door = null; this.doorPos = null;
    if (!rooms.length) {
      const k = new Kit();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; k.cyl(0.07, 0.07, 0.6, 0xe4c39a, PLOT.x + Math.cos(a) * 2.2, 0.3, PLOT.z + Math.sin(a) * 2.2); }
      k.add(new THREE.RingGeometry(1.6, 1.9, 24), 0xff9ec4, PLOT.x, 0.34, PLOT.z, -Math.PI / 2);
      this.house.add(new THREE.Mesh(k.build(), mat()));
      return;
    }
    const k = new Kit(), glow = new Kit();
    const top = new Map<string, number>();
    for (const c of rooms) top.set(`${c.gx},${c.gz}`, Math.max(top.get(`${c.gx},${c.gz}`) ?? 0, c.lv));
    for (const c of rooms) {
      const [x, z] = cellPos(c), R = ROOMS[c.type], y = 0.3 + c.lv * 2.2, w = CELL - 0.3;
      k.box(w, 2.2, w, R.wall, x, y, z).box(w + 0.1, 0.25, w + 0.1, 0xfff1f6, x, y, z);
      // windows glow warm
      glow.box(0.7, 0.7, 0.05, 0xfff0b0, x - 0.8, y + 0.9, z + w / 2 + 0.01).box(0.7, 0.7, 0.05, 0xfff0b0, x + 0.8, y + 0.9, z + w / 2 + 0.01)
        .box(0.05, 0.7, 0.7, 0xfff0b0, x + w / 2 + 0.01, y + 0.9, z);
      if (top.get(`${c.gx},${c.gz}`) === c.lv) {
        const roof = new THREE.ConeGeometry(w * 0.78, 1.5, 4); roof.rotateY(Math.PI / 4);
        k.add(roof, c.type === 'greenhouse' || c.type === 'pool' || c.type === 'observatory' ? 0xbfeef0 : 0xff8fb8, x, y + 2.95, z);
        if (c.type === 'rooftop') k.cyl(0.05, 0.05, 0.8, 0x8a5a3c, x + 1.2, y + 2.2, z + 1.2);
      }
      this.blocks.push({ x, z, h: y + 2.2 });
    }
    // front door on the front-most column-0 ground room
    const front = rooms.filter((c) => c.lv === 0 && c.gx === 0).sort((a, b) => b.gz - a.gz)[0] ?? rooms.find((c) => c.lv === 0)!;
    const [fx, fz] = cellPos(front), dz = fz + (CELL - 0.3) / 2;
    k.box(1.0, 1.55, 0.12, 0x9a6a46, fx, 0.3, dz + 0.03).ball(0.06, 0xffd27a, fx + 0.3, 1.1, dz + 0.12);
    this.door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.9), new THREE.MeshBasicMaterial({ map: softDot(), color: 0xffc7a0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.door.position.set(fx, 1.1, dz + 0.15);
    this.doorPos = [fx, dz + 0.9];
    this.house.add(new THREE.Mesh(k.build(), mat()), new THREE.Mesh(glow.build(), basic(0xffffff, { vertexColors: true })), this.door);
    const lab = labelSprite('Enter', '#FFD27A', 0.9, false); lab.position.set(fx, 2.3, dz + 0.2); this.house.add(lab);
  }

  private rebuildCables() {
    this.cableLines && (this.scene.remove(this.cableLines), this.cableLines.geometry.dispose(), (this.cableLines.material as THREE.Material).dispose());
    this.cableIds = Object.keys(this.world.cables ?? {});
    if (!this.cableIds.length) { this.cableLines = null; return; }
    const pts: number[] = [];
    for (const id of this.cableIds) {
      const a = ANCHORS.find((x) => x.id === id); if (!a) continue;
      const ay = heightAt(a.x, a.z) + 2.4, by = heightAt(HOPPER.x, HOPPER.z) + 1.7;
      for (let i = 0; i < 24; i++) {
        for (const t of [i / 24, (i + 1) / 24]) {
          pts.push(THREE.MathUtils.lerp(a.x, HOPPER.x + 0.5, t), THREE.MathUtils.lerp(ay, by, t) - Math.sin(t * Math.PI) * 1.1, THREE.MathUtils.lerp(a.z, HOPPER.z + 0.5, t));
        }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.cableLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9 }));
    this.scene.add(this.cableLines);
  }

  setWorld(w: WorldDoc) {
    const prev = this.world;
    this.world = w;
    // map planted saplings into free slots
    const planted = Object.entries(w.planted ?? {}).slice(0, 20);
    const slots = this.nodes.filter((n) => n.kind === 'planted');
    slots.forEach((n, i) => {
      const p = planted[i];
      if (p) { n.id = p[0]; n.x = p[1].x; n.z = p[1].z; n.y = heightAt(n.x, n.z); n.s = 0.9; } else n.id = '';
    });
    if (JSON.stringify(prev.rooms) !== JSON.stringify(w.rooms)) this.rebuildHouse();
    if (JSON.stringify(prev.cables) !== JSON.stringify(w.cables)) this.rebuildCables();
    this.refreshNodes();
  }

  spawn(who: Who): [number, number, number] { const x = who === 'shaurya' ? -0.7 : 0.7; return [x, heightAt(x, 6), 6]; }

  ground(x: number, z: number, _y?: number) {
    if (superR(x, z) > 16.2) return null;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r - 0.2) return null;
    for (const n of this.nodes) {
      if (!n.id || (this.world.nodes?.[n.id] ?? 0) > Date.now()) continue;
      const rad = n.kind === 'rock' ? 0.75 : n.kind === 'crystal' ? 0.55 : n.kind === 'flower' ? 0 : n.kind === 'planted' ? 0.25 : 0.3;
      if (rad && Math.hypot(x - n.x, z - n.z) < rad) return null;
    }
    for (const b of this.blocks) if (Math.abs(x - b.x) < CELL / 2 && Math.abs(z - b.z) < CELL / 2) return null;
    if (Math.abs(x - HOPPER.x) < 0.7 && Math.abs(z - HOPPER.z) < 0.7) return null;
    if (Math.abs(x - BENCH.x) < 0.8 && Math.abs(z - BENCH.z) < 0.45) return null;
    if (Math.hypot(x - NEST.x, z - NEST.z) < 1.1) return null;
    return heightAt(x, z);
  }

  interactables(px: number, pz: number): Interactable[] {
    const out: Interactable[] = [], now = Date.now(), near = (x: number, z: number, d = 3.5) => Math.abs(px - x) < d && Math.abs(pz - z) < d;
    for (const n of this.nodes) {
      if (!n.id || (this.world.nodes?.[n.id] ?? 0) > now || !near(n.x, n.z)) continue;
      if (n.kind === 'birch' || n.kind === 'cherry') out.push({ id: n.id, x: n.x, z: n.z, r: 1.3, label: 'Chop', icon: '🪓', tool: 'hatchet' });
      if (n.kind === 'planted') {
        const p = this.world.planted?.[n.id];
        if (p && now - p.at > 90_000) out.push({ id: n.id, x: n.x, z: n.z, r: 1.2, label: 'Chop', icon: '🪓', tool: 'hatchet' });
        else out.push({ id: 'water:' + n.id, x: n.x, z: n.z, r: 1.1, label: 'Water sapling', icon: '💧', tool: 'can', needs: 'can' });
      }
      if (n.kind === 'rock') out.push({ id: n.id, x: n.x, z: n.z, r: 1.5, label: 'Mine', icon: '⛏️', tool: 'pickaxe' });
      if (n.kind === 'crystal') out.push({ id: n.id, x: n.x, z: n.z, r: 1.3, label: 'Mine crystal', icon: '💎', tool: 'pickaxe', needs: 'pickaxe' });
      if (n.kind === 'flower') out.push({ id: n.id, x: n.x, z: n.z, r: 1.3, label: 'Pick flowers', icon: '🌼' });
    }
    this.bugs.forEach((b, i) => b.gone < now && near(b.x, b.z, 2.5) && out.push({ id: 'bug' + i, x: b.x, z: b.z, r: 1.7, label: 'Catch', icon: '🦋', tool: 'net', needs: 'net' }));
    const pd = Math.hypot(px - POND.x, pz - POND.z);
    if (pd < POND.r + 1.4) out.push({ id: 'fish', x: px, z: pz, r: 9, label: 'Fish', icon: '🎣', tool: 'rod', needs: 'rod' });
    out.push({ id: 'bench', x: BENCH.x, z: BENCH.z, r: 1.6, label: 'Craft tools', icon: '🔨' });
    out.push({ id: 'hopper', x: HOPPER.x, z: HOPPER.z, r: 1.6, label: 'Resource Hopper', icon: '📦' });
    out.push({ id: 'nest', x: NEST.x, z: NEST.z, r: 2, label: 'Pet Nest', icon: '🐾' });
    for (const a of ANCHORS) out.push({ id: 'anchor:' + a.id, x: a.x, z: a.z, r: 1.6, label: this.world.cables?.[a.id] ? 'Sky-Cable ✓' : 'Build Sky-Cable', icon: '🚡' });
    if (this.doorPos) out.push({ id: 'door', x: this.doorPos[0], z: this.doorPos[1], r: 1.5, label: 'Enter', icon: '🚪' });
    const rooms = Object.keys(this.world.rooms ?? {}).length;
    out.push({ id: 'plot', x: rooms ? PLOT.x + 3.2 : PLOT.x, z: rooms ? PLOT.z + 7 : PLOT.z + 1.5, r: rooms ? 1.5 : 3.2, label: rooms ? 'Expand house' : 'Build first room', icon: '🏡' });
    for (const s of this.sniffs) if (s.until > now) out.push({ id: 'sniff', x: s.x, z: s.z, r: 1.4, label: 'Dig crystal', icon: '✨' });
    return out;
  }

  interact(id: string, E: EngineAPI) {
    const now = Date.now();
    const n = this.nodes.find((x) => x.id === id);
    if (n) {
      const ex = n.x, ey = n.y + 1, ez = n.z;
      if (n.kind === 'flower') {
        E.play('pat', 0.5); E.fx('blossom', ex, n.y + 0.4, ez, 14); E.sound('pick');
        E.patch({ [`nodes.${id}`]: now + 60_000 }); E.give({ flower: 2 * E.synergy() }, ex, ey, ez, 'flowers');
        return;
      }
      const tree = n.kind === 'birch' || n.kind === 'cherry' || n.kind === 'planted';
      const tool = tree ? 'hatchet' : 'pickaxe';
      const strong = E.toolFor(tool);
      E.swing(); n.wob = 0.35;
      setTimeout(() => {
        E.hitStop(70); E.shake(0.12);
        if (tree) { E.fx(n.kind === 'cherry' || (n.kind === 'planted' && n.idx % 2 === 0) ? 'blossom' : 'leaf', ex, n.y + 1.7, ez, 16); E.sound('chop'); }
        else { E.fx(n.kind === 'crystal' ? 'crystal' : 'stone', ex, n.y + 0.5, ez, 14); E.sound(n.kind === 'crystal' ? 'crystal' : 'clink'); }
        n.hp += strong ? 2 : 1;
        if (n.hp >= 4) {
          n.hp = 0;
          const res: Record<string, number> = tree ? { wood: (strong ? 3 : 2) * E.synergy() } : n.kind === 'crystal' ? { crystal: 1 * E.synergy() } : { stone: (strong ? 3 : 2) * E.synergy() };
          if (n.kind === 'planted') E.patch({ [`planted.${id}.at`]: now }, {});
          else E.patch({ [`nodes.${id}`]: now + (tree ? 90_000 : n.kind === 'crystal' ? 150_000 : 100_000) });
          E.give(res, ex, ey, ez); E.fx('gold', ex, ey, ez, 18);
        }
      }, 110);
      return;
    }
    if (id.startsWith('water:')) { E.play('pat', 0.6); E.fx('splash', E.player.x, E.player.y + 0.5, E.player.z, 12); E.sound('splash'); E.patch({ [`planted.${id.slice(6)}.at`]: (this.world.planted?.[id.slice(6)]?.at ?? now) - 30_000 }); E.toast('💧 Watered', 'It grows faster now'); return; }
    if (id.startsWith('bug')) {
      const b = this.bugs[Number(id.slice(3))]; E.swing();
      if (Math.random() < 0.8) { b.gone = now + 40_000; E.fx('spark', b.x, b.y, b.z, 14); E.sound('catch'); E.give({ bug: 1 }, b.x, b.y, b.z, 'butterfly'); }
      else { E.toast('Missed!', 'It fluttered away… try again'); b.a += 2; }
      return;
    }
    if (id === 'fish') {
      E.play('cast', 1.8); E.sound('cast');
      setTimeout(() => {
        E.fx('splash', POND.x + (E.player.x - POND.x) * 0.6, 0, POND.z + (E.player.z - POND.z) * 0.6, 16); E.sound('splash');
        if (Math.random() < 0.72) E.give({ fish: 1 * E.synergy() }, E.player.x, E.player.y + 1, E.player.z, 'koi'); else E.toast('🎣 The koi got away', 'So close!');
      }, 1600);
      return;
    }
    if (id === 'sniff') { const s = this.sniffs.find((x) => x.until > now); if (s) s.until = 0; E.play('pat', 0.6); E.fx('crystal', E.player.x, E.player.y + 0.3, E.player.z, 20); E.give({ crystal: 1 }, E.player.x, E.player.y + 1, E.player.z, 'hidden crystal'); return; }
    if (id === 'door') return E.enter();
    if (id === 'plot') return E.ui('build');
    if (id === 'bench') return E.ui('craft');
    if (id === 'nest') return E.ui('pets');
    if (id === 'hopper') { const c = Object.keys(this.world.cables ?? {}).length; E.toast('📦 Resource Hopper', c ? `${c} Sky-Cable${c > 1 ? 's' : ''} zipping resources in automatically` : 'Build Sky-Cables at the grove posts to fill it automatically'); return; }
    if (id.startsWith('anchor:')) {
      const a = ANCHORS.find((x) => x.id === id.slice(7))!;
      if (this.world.cables?.[a.id]) { E.toast(`🚡 ${a.label} cable`, `Zips +1 ${a.res} into the hopper every 40s while you are both here`); return; }
      if (!canAfford(this.world.inv, CABLE_COST)) { E.toast('Need more materials', `Sky-Cable costs ${costText(CABLE_COST)}`); return; }
      E.patch({ [`cables.${a.id}`]: { at: now, by: E.me } }, negate(CABLE_COST)); E.sound('build'); E.fx('gold', a.x, 2.4, a.z, 30);
      E.toast('🚡 Sky-Cable built!', `${a.label} → Resource Hopper`);
    }
  }

  /** planting spot for the watering can when nothing else is near */
  plantAt(x: number, z: number) {
    if (superR(x, z) > 14.5 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.2 || Math.hypot(x - PLOT.x, z - PLOT.z) < 7) return false;
    return this.nodes.every((n) => !n.id || Math.hypot(n.x - x, n.z - z) > 1.4) && Object.keys(this.world.planted ?? {}).length < 20;
  }

  /** a pet found a buried crystal near (x,z) */
  sniff(x: number, z: number) { this.sniffs = [{ x, z, until: Date.now() + 25_000 }]; }
  sniffMark() { const s = this.sniffs.find((x) => x.until > Date.now()); return s ?? null; }

  update(dt: number, t: number, E: EngineAPI) {
    this.uTime.value = t;
    // clouds bob
    for (let i = 0; i < this.cloudBase.length; i++) {
      const c = this.cloudBase[i];
      this.m4.compose(this.v.set(c.x + Math.sin(t * 0.1 + c.p) * 0.4, c.y + Math.sin(t * 0.35 + c.p) * 0.25, c.z), this.q.identity(), this.s3.set(c.s * 1.25, c.s * 0.75, c.s));
      this.clouds.setMatrixAt(i, this.m4);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    // butterflies flutter in figure-eights
    const now = Date.now();
    this.bugs.forEach((b, i) => {
      b.a += dt * 0.7;
      b.x = b.cx + Math.sin(b.a) * 2.2; b.z = b.cz + Math.sin(b.a * 2) * 1.2; b.y = heightAt(b.x, b.z) + 0.9 + Math.sin(t * 3 + i) * 0.25;
      const flap = 0.3 + Math.abs(Math.sin(t * 14 + i)) * 0.9;
      this.m4.compose(this.v.set(b.x, b.y, b.z), this.q.setFromEuler(this.e.set(0, b.a + Math.PI / 2, 0)), this.s3.set(b.gone > now ? 0.0001 : flap, 1, 1));
      this.flies.setMatrixAt(i, this.m4);
    });
    this.flies.instanceMatrix.needsUpdate = true;
    // koi circle the pond
    for (let i = 0; i < 5; i++) {
      const a = t * (0.3 + i * 0.05) + i * 1.3, rr = 1 + i * 0.4;
      this.m4.compose(this.v.set(POND.x + Math.cos(a) * rr, -0.22, POND.z + Math.sin(a) * rr), this.q.setFromEuler(this.e.set(0, -a, 0)), this.s3.setScalar(1));
      this.koi.setMatrixAt(i, this.m4);
    }
    this.koi.instanceMatrix.needsUpdate = true;
    // hit wobble
    let wob = false;
    for (const n of this.nodes) if (n.wob > 0) { n.wob = Math.max(0, n.wob - dt); wob = true; }
    if (wob || (this.refT += dt) > 2) { this.refT = 0; this.refreshNodes(); }
    if (this.door) (this.door.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 3) * 0.2;
    // Sky-Cable packets glide to the hopper; Shaurya's phone is the single source of truth for income
    let pi = 0;
    for (const id of this.cableIds) {
      const a = ANCHORS.find((x) => x.id === id); if (!a) continue;
      for (let k = 0; k < 3 && pi < 12; k++, pi++) {
        const tt = ((t * 0.12 + k / 3) % 1), ay = heightAt(a.x, a.z) + 2.4, by = heightAt(HOPPER.x, HOPPER.z) + 1.7;
        this.m4.makeTranslation(THREE.MathUtils.lerp(a.x, HOPPER.x + 0.5, tt), THREE.MathUtils.lerp(ay, by, tt) - Math.sin(tt * Math.PI) * 1.1 - 0.15, THREE.MathUtils.lerp(a.z, HOPPER.z + 0.5, tt));
        this.packets.setMatrixAt(pi, this.m4);
      }
    }
    for (; pi < 12; pi++) this.packets.setMatrixAt(pi, this.m4.makeScale(0, 0, 0));
    this.packets.instanceMatrix.needsUpdate = true;
    if (E.me === 'shaurya' && this.cableIds.length && now - this.lastIncome > 40_000) {
      if (this.lastIncome) {
        const inc: Record<string, number> = {};
        for (const id of this.cableIds) { const a = ANCHORS.find((x) => x.id === id); if (a) inc[`inv.${a.res}`] = (inc[`inv.${a.res}`] ?? 0) + 1; }
        E.patch({}, inc); E.fx('gold', HOPPER.x, 1.8, HOPPER.z, 12);
      }
      this.lastIncome = now;
    }
  }

  dispose() { disposeTree(this.scene); (this.scene.background as THREE.Texture)?.dispose(); }
}
