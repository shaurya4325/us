// OverworldScene: the five-biome pastel archipelago. Terrain + biome dressing are streamed by BiomeStreamer,
// ruins & puzzles live in AbandonedStructures; this file owns the homestead camp, resource nodes, collisions,
// the sky/fog blend between biomes and everything you can interact with outside.
import * as THREE from 'three';
import {
  BIOMES, BIOME_IDS, EDGE, FOOTBRIDGES, PLOT, POND, SHRINE, STREAM, biomeAt, landInfo, platformH, sampleTerrain, superR, waterAt,
  type BiomeId, type Surface,
} from '../data/biomes';
import { BLOCKS, dayKey } from '../data/craftingRegistry';
import { Kit, basic, disposeTree, labelSprite, mat, rand, seeThrough, softDot, waterMaterial, windy } from './gfx';
import { CABLE_COST, ROOMS, canAfford, costText, item, negate, type RoomCell } from './catalog';
import { GIANTS, KINDS, SPAWNS, type NodeKindId, type Part } from './nodes';
import { BiomeStreamer } from './BiomeStreamer';
import { Structures } from './AbandonedStructures';
import { addDecor } from './decor';
import type { EngineAPI, Interactable, SceneAPI, WorldDoc } from './types';
import type { Who } from '../config/people';

export { heightAt } from '../data/biomes';
const CELL = 4;
const HOPPER = { x: -2.4, z: 1.4 }, BENCH = { x: -3.8, z: -2.4 }, NEST = { x: -10.5, z: -8.5 };
const ANCHORS = [
  { id: 'west', x: -12.5, z: -2, res: 'wood', label: 'West Birch Grove' },
  { id: 'east', x: 12.5, z: 4.5, res: 'wood', label: 'East Cherry Grove' },
  { id: 'quarry', x: 2, z: -12.5, res: 'stone', label: 'Rose Quarry' },
] as const;
/** the homestead camp: the crafting table plus spots where crafted functional blocks appear */
export const CAMP: Record<string, { x: number; z: number }> = {
  table: BENCH, furnace: { x: -6.8, z: -1.3 }, anvil: { x: -6.9, z: -4.4 }, loom: { x: -4.3, z: -6.5 }, hearth: { x: -1.5, z: -6.7 }, chest: { x: -1.3, z: -1.7 }, board: { x: -2.5, z: 8.6 },
};
export const cellPos = (c: { gx: number; gz: number }) => [PLOT.x + c.gx * CELL, PLOT.z + c.gz * CELL] as const;
const H = (x: number, z: number) => sampleTerrain(x, z).h;

interface Node { id: string; kind: NodeKindId; biome: BiomeId; x: number; z: number; y: number; s: number; idx: number; hp: number; wob: number; rot: number }
interface NodeSet { biome: BiomeId; kind: NodeKindId; meshes: { m: THREE.InstancedMesh; part: Part }[]; nodes: Node[]; dirty: boolean }
interface Bug { x: number; y: number; z: number; a: number; cx: number; cz: number; gone: number; biome: BiomeId }

/** a 4x4 bucket grid so collision and "what's near me" checks stay cheap with hundreds of nodes */
class Grid<T extends { x: number; z: number }> {
  private m = new Map<number, T[]>();
  private k = (x: number, z: number) => (Math.floor(x / 4) + 100) * 1000 + (Math.floor(z / 4) + 100);
  add(t: T) { const k = this.k(t.x, t.z); (this.m.get(k) ?? this.m.set(k, []).get(k)!).push(t); }
  near(x: number, z: number, r: number, out: T[] = []) {
    out.length = 0;
    for (let i = Math.floor((x - r) / 4); i <= Math.floor((x + r) / 4); i++) for (let j = Math.floor((z - r) / 4); j <= Math.floor((z + r) / 4); j++) { const b = this.m.get((i + 100) * 1000 + (j + 100)); if (b) out.push(...b); }
    return out;
  }
}

export class Overworld implements SceneAPI {
  kind = 'over' as const;
  scene = new THREE.Scene();
  private uTime = { value: 0 };
  private streamer: BiomeStreamer; private ruins: Structures;
  private nodes: Node[] = []; private sets: NodeSet[] = []; private grid = new Grid<Node>(); private tmp: Node[] = [];
  private bugs: Bug[] = []; private flies = new Map<BiomeId, THREE.InstancedMesh>();
  private koi!: THREE.InstancedMesh;
  private house = new THREE.Group(); private door: THREE.Mesh | null = null; private doorPos: [number, number] | null = null;
  private blocks: { x: number; z: number; h: number }[] = [];
  private stationMesh: THREE.Mesh | null = null; private ghostMesh: THREE.Mesh | null = null; private decorMesh: THREE.Group = new THREE.Group();
  private cableLines: THREE.LineSegments | null = null; private packets!: THREE.InstancedMesh; private cableIds: string[] = [];
  private world: WorldDoc = {};
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private v = new THREE.Vector3(); private s3 = new THREE.Vector3(); private e = new THREE.Euler(); private col = new THREE.Color();
  private lastIncome = 0; private refT = 0; private skyT = 0; private sniffs: { x: number; z: number; until: number }[] = [];
  private skyCanvas = document.createElement('canvas'); private skyTex: THREE.CanvasTexture;
  private fogC = new THREE.Color(); private fogTarget = new THREE.Color(); private near = 36; private far = 92; private nearT = 36; private farT = 92;
  private skyNow = [new THREE.Color(), new THREE.Color(), new THREE.Color()]; private skyTarget = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
  biome: BiomeId = 'prairie';

  constructor() {
    const S = this.scene;
    this.skyCanvas.width = 4; this.skyCanvas.height = 256;
    this.skyTex = new THREE.CanvasTexture(this.skyCanvas); this.skyTex.colorSpace = THREE.SRGBColorSpace;
    S.background = this.skyTex; S.fog = new THREE.Fog(0xe9f4f0, 36, 92);
    BIOMES.prairie.sky.forEach((c, i) => { this.skyNow[i].set(c); this.skyTarget[i].set(c); });
    this.fogC.set(BIOMES.prairie.fog); this.fogTarget.copy(this.fogC); this.paintSky();
    this.streamer = new BiomeStreamer(S, this.uTime);
    this.ruins = new Structures(this.streamer.groups);
    this.buildNodes(); this.buildHomestead(); this.buildLife();
    this.streamer.groups.prairie.add(this.house);
    S.add(this.decorMesh);
    const pk = new Kit().ball(0.14, 0xfff0c8).build();
    this.packets = new THREE.InstancedMesh(pk, basic(0xffffff, { vertexColors: true }), 12);
    this.packets.frustumCulled = false; this.streamer.groups.prairie.add(this.packets);
    for (const id of BIOME_IDS) BiomeStreamer.bound(this.streamer.groups[id], id);
  }

  /* ---------------- sky + fog blend ---------------- */
  private paintSky() {
    const g = this.skyCanvas.getContext('2d')!, gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#' + this.skyNow[0].getHexString()); gr.addColorStop(0.6, '#' + this.skyNow[1].getHexString()); gr.addColorStop(1, '#' + this.skyNow[2].getHexString());
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256); this.skyTex.needsUpdate = true;
  }
  private blendSky(x: number, z: number) {
    const { w } = landInfo(x, z);
    let sum = 0; for (const id of BIOME_IDS) sum += w[id];
    if (sum < 0.01) return;
    this.fogTarget.setRGB(0, 0, 0); this.skyTarget.forEach((c) => c.setRGB(0, 0, 0)); this.nearT = 0; this.farT = 0;
    for (const id of BIOME_IDS) {
      const k = w[id] / sum; if (k < 0.001) continue;
      const B = BIOMES[id];
      this.col.set(B.fog); this.fogTarget.r += this.col.r * k; this.fogTarget.g += this.col.g * k; this.fogTarget.b += this.col.b * k;
      B.sky.forEach((c, i) => { this.col.set(c); this.skyTarget[i].r += this.col.r * k; this.skyTarget[i].g += this.col.g * k; this.skyTarget[i].b += this.col.b * k; });
      this.nearT += B.fogNear * k; this.farT += B.fogFar * k;
    }
  }

  /* ---------------- resource nodes ---------------- */
  private buildNodes() {
    // the original prairie nodes keep their ids (b3, r1…) so saved respawn timers stay valid
    const r = rand(42), list: Node[] = [];
    const free = (x: number, z: number, d: number) => superR(x, z) < EDGE - 1 && Math.hypot(x - POND.x, z - POND.z) > POND.r + 1.4 && Math.hypot(x - PLOT.x, z - PLOT.z) > 8.5
      && Math.hypot(x, z - 6) > 3 && Math.hypot(x - NEST.x, z - NEST.z) > 2.2 && Math.hypot(x - HOPPER.x, z - HOPPER.z) > 2.2 && Math.hypot(x - BENCH.x, z - BENCH.z) > 2
      && ANCHORS.every((a) => Math.hypot(x - a.x, z - a.z) > 1.8) && list.every((n) => Math.hypot(n.x - x, n.z - z) > d);
    const place = (kind: NodeKindId, cx: number, cz: number, spread: number, count: number, d: number, prefix: string) => {
      for (let i = 0, tries = 0; i < count && tries < 400; tries++) {
        const x = cx + (r() - 0.5) * spread, z = cz + (r() - 0.5) * spread;
        if (!free(x, z, d)) continue;
        list.push({ id: prefix + list.filter((n) => n.kind === kind).length, kind, biome: 'prairie', x, z, y: H(x, z), s: 0.85 + r() * 0.4, idx: 0, hp: 0, wob: 0, rot: x }); i++;
      }
    };
    place('birch', -11, -1, 8, 9, 1.7, 'b'); place('cherry', 11, 5, 8, 9, 1.7, 'c');
    place('birch', -2, 13, 10, 3, 1.7, 'b'); place('cherry', 6, 12, 8, 3, 1.7, 'c');
    place('rock', 2, -12, 9, 7, 1.4, 'r'); place('rock', -13, 9, 5, 3, 1.4, 'r');
    place('crystal', 5, -13, 7, 4, 1.4, 'x'); place('crystal', 13, -6, 4, 2, 1.4, 'x');
    place('birch', -18, -14, 8, 6, 1.7, 'b'); place('cherry', 18, 15, 8, 6, 1.7, 'c'); place('cherry', -17, 15, 7, 4, 1.7, 'c');
    place('birch', 16, -17, 7, 4, 1.7, 'b'); place('rock', -19, 2, 6, 4, 1.4, 'r'); place('rock', 19, -4, 6, 3, 1.4, 'r');
    place('crystal', -14, -19, 5, 3, 1.4, 'x'); place('crystal', 6, 19, 6, 2, 1.4, 'x');
    place('flower', 0, 19, 8, 2, 2, 'f'); place('flower', -19, -6, 6, 2, 2, 'f'); place('flower', 19, 8, 6, 2, 2, 'f');
    place('flower', -4, -9, 8, 3, 2, 'f'); place('flower', 10, -1, 6, 2, 2, 'f'); place('flower', -9, 12, 5, 2, 2, 'f');
    // keep the new camp, the land bridges and the ruins clear (dropping a node never renames the others)
    const keepClear = [...Object.values(CAMP), { x: 21, z: 1 }, { x: -21, z: -1 }, { x: 1, z: -21 }, { x: -1, z: 21 }];
    this.nodes = list.filter((n) => keepClear.every((c) => Math.hypot(n.x - c.x, n.z - c.z) > 2.1));
    for (let i = 0; i < 20; i++) this.nodes.push({ id: '', kind: 'planted', biome: 'prairie', x: 0, z: 0, y: 0, s: 0, idx: 0, hp: 0, wob: 0, rot: 0 });
    // the four outer biomes
    const struct = this.ruins.defs.map((d) => [d.x, d.z, d.id === 'treehouse' ? 10.5 : d.id === 'shrine' ? 8 : d.id === 'grotto' ? 4 : 6.5] as const);
    (Object.keys(SPAWNS) as (keyof typeof SPAWNS)[]).forEach((b, bi) => {
      const B = BIOMES[b], rr = rand(100 + bi * 17), counts: Record<string, number> = {};
      for (const [kind, ox, oz, spread, count, d] of SPAWNS[b]) {
        for (let i = 0, tries = 0; i < count && tries < 300; tries++) {
          const x = B.cx + ox + (rr() - 0.5) * spread, z = B.cz + oz + (rr() - 0.5) * spread;
          if (!this.spotOk(kind, b, x, z, d, struct)) continue;
          counts[kind] = (counts[kind] ?? -1) + 1;
          this.nodes.push({ id: `${kind}${counts[kind]}`, kind, biome: b, x, z, y: H(x, z), s: KINDS[kind].scale[0] + rr() * (KINDS[kind].scale[1] - KINDS[kind].scale[0]), idx: 0, hp: 0, wob: 0, rot: rr() * 6.28 });
          i++;
        }
      }
    });
    for (const g of GIANTS) this.nodes.push({ id: g.id, kind: g.kind, biome: g.biome, x: g.x, z: g.z, y: H(g.x, g.z), s: 1, idx: 0, hp: 0, wob: 0, rot: 0.6 });
    // one InstancedMesh per (biome, kind, part), parented to the biome's streamed group
    const byKey = new Map<string, Node[]>();
    for (const n of this.nodes) { const k = `${n.biome}:${n.kind}`; (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(n); }
    const shared = { matcap: seeThrough(mat()), glow: seeThrough(basic(0xffffff)) };
    const winds = new Map<number, THREE.Material>();
    for (const [key, ns] of byKey) {
      const [biome, kind] = key.split(':') as [BiomeId, NodeKindId];
      ns.forEach((n, i) => (n.idx = i));
      const set: NodeSet = { biome, kind, nodes: ns, dirty: true, meshes: [] };
      for (const part of KINDS[kind].parts) {
        const material = part.glow ? shared.glow : part.wind ? winds.get(part.wind) ?? winds.set(part.wind, seeThrough(windy(mat(), this.uTime, part.wind))).get(part.wind)! : shared.matcap;
        const m = new THREE.InstancedMesh(part.geo(), material, ns.length);
        ns.forEach((n, i) => m.setColorAt(i, this.col.set(part.palette ? part.palette[(i * 7 + (n.id.length * 3)) % part.palette.length] : 0xffffff)));
        this.streamer.groups[biome].add(m); set.meshes.push({ m, part });
      }
      this.sets.push(set);
    }
    for (const n of this.nodes) if (n.id && n.kind !== 'planted') this.grid.add(n);
    this.refreshNodes(true);
  }
  private spotOk(kind: NodeKindId, b: BiomeId, x: number, z: number, d: number, struct: readonly (readonly [number, number, number])[]) {
    const { L, w } = landInfo(x, z);
    if (L < 1.4) return false;
    let sum = 0; for (const id of BIOME_IDS) sum += w[id];
    if (w[b] / sum < 0.7) return false;
    const h = H(x, z), wl = waterAt(x, z);
    if (kind === 'pearl') { if (wl === null || h > wl - 0.08 || h < -0.85) return false; }
    else if (kind === 'seaglass') { if (wl === null || h < wl - 0.3 || h > wl + 0.5) return false; }
    else if (wl !== null && h < wl + 0.12) return false;
    if (b === 'sakura' && (Math.abs(z - STREAM.z(x)) < 2.8 || Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.r + 1.8)) return false;
    if (FOOTBRIDGES.some((f) => Math.hypot(x - f.x, z - f.z) < 3.5)) return false;
    if (struct.some(([sx, sz, sr]) => Math.hypot(x - sx, z - sz) < sr)) return false;
    if (GIANTS.some((g) => Math.hypot(x - g.x, z - g.z) < 4)) return false;
    return this.nodes.every((n) => n.biome !== b || Math.hypot(n.x - x, n.z - z) > d);
  }
  private isDown(n: Node, now: number) {
    if (KINDS[n.kind].giant) return (this.world.giants?.[n.id]?.down ?? 0) > now;
    return (this.world.nodes?.[n.id] ?? 0) > now;
  }
  private refreshNodes(all = false) {
    const now = Date.now();
    for (const set of this.sets) {
      if (!all && !set.dirty && !this.streamer.groups[set.biome].visible) continue;
      set.dirty = false;
      for (const n of set.nodes) {
        const down = this.isDown(n, now), K = KINDS[n.kind];
        let s = n.s;
        if (n.kind === 'planted') { const p = this.world.planted?.[n.id]; s = p && n.id ? Math.min(1, 0.25 + (now - p.at) / 90_000) * 0.9 : 0; }
        const wob = n.wob > 0 ? Math.sin(n.wob * 40) * n.wob * 0.5 : 0, live = s > 0 && !down;
        for (const { m, part } of set.meshes) {
          const show = part.stump ? down && s > 0 : live;
          this.m4.compose(this.v.set(n.x, n.y, n.z), this.q.setFromEuler(this.e.set(wob * (K.tree ? 0.3 : 0), n.rot, wob * (K.tree ? 0.3 : 0.4))), this.s3.setScalar(show ? (part.stump ? n.s : s) : 0.0001));
          m.setMatrixAt(n.idx, this.m4);
        }
      }
      // skip draws that would show nothing (no stumps yet, no planted saplings yet)
      const anyDown = set.nodes.some((n) => n.id && this.isDown(n, now)), anyLive = set.nodes.some((n) => n.id && !this.isDown(n, now));
      for (const { m, part } of set.meshes) { m.visible = part.stump ? anyDown : anyLive || !!set.nodes.find((n) => n.wob > 0); m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    }
  }

  /* ---------------- homestead camp (prairie) ---------------- */
  private buildHomestead() {
    const k = new Kit(), r = rand(9), G = this.streamer.groups.prairie;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, rr = POND.r + 0.25 + r() * 0.3, x = POND.x + Math.cos(a) * rr, z = POND.z + Math.sin(a) * rr;
      k.add(new THREE.DodecahedronGeometry(0.16 + r() * 0.12, 0), 0xe7e0ee, x, H(x, z) + 0.03, z, r(), r(), 0, 1, 0.6, 1);
    }
    for (let i = 0; i < 5; i++) {
      const a = r() * 6.28, rr = r() * (POND.r - 0.8);
      k.add(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 10, 1, false, 0, 5.6), 0x7cc47f, POND.x + Math.cos(a) * rr, -0.06, POND.z + Math.sin(a) * rr);
      if (i % 2 === 0) k.ball(0.08, 0xffb3d4, POND.x + Math.cos(a) * rr, 0.0, POND.z + Math.sin(a) * rr, 1, 0.6, 1, 0);
    }
    for (let i = 0; i < 6; i++) { const x = PLOT.x - 0.4 * i, z = PLOT.z + 6.4 + i * 0.9; k.add(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 8), 0xf0e6dc, x, H(x, z) + 0.02, z); }
    // soft stone paths from the spawn to each land bridge
    for (const [tx, tz] of [[21, 1], [-21, -1], [1, -21], [-1, 21]]) for (let i = 3; i < 11; i++) { const x = (tx * i) / 11, z = (tz * i) / 11 + (tz === 0 ? 6 * (1 - i / 11) : 0); k.add(new THREE.CylinderGeometry(0.36, 0.38, 0.05, 8), 0xf0e6dc, x + Math.sin(i) * 0.3, H(x, z) + 0.02, z); }
    const hy = H(HOPPER.x, HOPPER.z);
    k.box(1.1, 0.7, 1.1, 0xb98057, HOPPER.x, hy, HOPPER.z).add(new THREE.CylinderGeometry(0.75, 0.3, 0.6, 8, 1, true), 0xf5a3c7, HOPPER.x, hy + 1.0, HOPPER.z)
      .cyl(0.05, 0.05, 1.6, 0x8a5a3c, HOPPER.x + 0.5, hy, HOPPER.z + 0.5).ball(0.12, 0xfff07a, HOPPER.x + 0.5, hy + 1.7, HOPPER.z + 0.5);
    const ny = H(NEST.x, NEST.z);
    k.add(new THREE.TorusGeometry(0.9, 0.28, 6, 14), 0xc79a6b, NEST.x, ny + 0.2, NEST.z, Math.PI / 2).ball(0.55, 0xfff1f6, NEST.x, ny + 0.15, NEST.z, 1.4, 0.4, 1.4)
      .ball(0.25, 0xffc6dc, NEST.x + 0.3, ny + 0.35, NEST.z - 0.2).ball(0.2, 0xcfe3ff, NEST.x - 0.3, ny + 0.33, NEST.z + 0.2);
    for (const a of ANCHORS) { const y = H(a.x, a.z); k.cyl(0.12, 0.16, 2.4, 0x9a6a46, a.x, y, a.z).box(0.7, 0.1, 0.1, 0x9a6a46, a.x, y + 2.1, a.z).ball(0.16, 0xfff07a, a.x, y + 2.5, a.z, 1, 1, 1, 0); }
    // the Adventure Board (always there)
    const B = CAMP.board, by = H(B.x, B.z);
    k.cyl(0.07, 0.08, 1.9, 0x8a5a3c, B.x - 0.7, by, B.z).cyl(0.07, 0.08, 1.9, 0x8a5a3c, B.x + 0.7, by, B.z).box(1.7, 1.0, 0.1, 0xc08a5e, B.x, by + 0.85, B.z).add(new THREE.ConeGeometry(1.2, 0.35, 4), 0xff8fb8, B.x, by + 2.05, B.z, 0, Math.PI / 4, 0, 1, 1, 0.35);
    [[-0.45, 1.45, 0xfff6e8], [0.2, 1.5, 0xffe3ee], [0.5, 1.15, 0xe6f4ff], [-0.2, 1.1, 0xfff0b0]].forEach(([dx, dy, c]) => k.box(0.42, 0.34, 0.03, c, B.x + dx, by + dy - 0.2, B.z + 0.07));
    G.add(new THREE.Mesh(k.build(), mat()));
    const pw = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 0.25, 40), waterMaterial(this.uTime)); pw.rotation.x = -Math.PI / 2; pw.position.set(POND.x, -0.1, POND.z); pw.renderOrder = 2; G.add(pw);
    const kk = new Kit().ball(0.12, 0xff8a3d, 0, 0, 0, 0.7, 0.45, 1.6).add(new THREE.ConeGeometry(0.08, 0.14, 4), 0xffffff, 0, 0, -0.22, Math.PI / 2);
    this.koi = new THREE.InstancedMesh(kk.build(), mat(), 5); this.koi.frustumCulled = false; G.add(this.koi);
    const sign = labelSprite('Our House Plot', '#F5A3C7', 1.2, false); sign.position.set(PLOT.x + 3.2, 1.9, PLOT.z + 7); G.add(sign);
    const board = labelSprite("Today's Quests", '#FFD27A', 1.0, false); board.position.set(B.x, by + 2.6, B.z); G.add(board);
    this.rebuildStations();
  }
  private station(k: Kit, g: Kit, id: string, x: number, z: number) {
    const y = H(x, z);
    switch (id) {
      case 'table': k.box(1.4, 0.55, 0.8, 0xc08a5e, x, y, z).box(1.5, 0.1, 0.9, 0xe0b080, x, y + 0.55, z).box(0.3, 0.2, 0.3, 0xb7b0c8, x - 0.45, y + 0.65, z - 0.1)
        .box(0.5, 0.05, 0.12, 0xf2b8a0, x + 0.3, y + 0.67, z).add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), 0x9a6a46, x + 0.25, y + 0.7, z + 0.25, 0, 0, Math.PI / 2); break;
      case 'furnace': k.box(1.1, 1.1, 1.0, 0xbfb6c8, x, y, z).box(0.55, 0.45, 0.06, 0x3a2f3a, x, y + 0.22, z + 0.5).cyl(0.16, 0.16, 0.5, 0xbfb6c8, x + 0.32, y + 1.1, z - 0.2, 8);
        g.box(0.46, 0.3, 0.04, 0xff9a4a, x, y + 0.26, z + 0.53); break;
      case 'anvil': k.cyl(0.38, 0.45, 0.45, 0xa8744f, x, y, z, 10).box(0.6, 0.18, 0.35, 0x4a4458, x, y + 0.45, z).box(0.95, 0.2, 0.42, 0x5a5468, x, y + 0.63, z)
        .add(new THREE.ConeGeometry(0.16, 0.42, 6), 0x5a5468, x + 0.62, y + 0.73, z, 0, 0, -Math.PI / 2).box(0.97, 0.03, 0.44, 0xffd27a, x, y + 0.83, z); break;
      case 'loom': k.cyl(0.06, 0.06, 1.5, 0xc08a5e, x - 0.6, y, z).cyl(0.06, 0.06, 1.5, 0xc08a5e, x + 0.6, y, z).box(1.3, 0.08, 0.08, 0xc08a5e, x, y + 1.45, z).box(1.3, 0.08, 0.08, 0xc08a5e, x, y + 0.4, z);
        for (let i = 0; i < 6; i++) k.box(0.03, 1.0, 0.03, [0xff9ec4, 0xfff1f6, 0xb6a6ff][i % 3], x - 0.45 + i * 0.18, y + 0.45, z);
        k.cyl(0.32, 0.28, 0.42, 0x8a5a3c, x + 1.0, y, z + 0.3, 12); g.cyl(0.28, 0.28, 0.02, 0xff7db5, x + 1.0, y + 0.4, z + 0.3, 12); break;
      case 'hearth': for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28; k.add(new THREE.DodecahedronGeometry(0.2, 0), 0xbfb6c8, x + Math.cos(a) * 0.6, y + 0.1, z + Math.sin(a) * 0.6, i, i, 0, 1, 0.7, 1); }
        k.add(new THREE.SphereGeometry(0.42, 12, 8, 0, 6.29, Math.PI * 0.35, Math.PI * 0.65), 0x3a3446, x, y + 0.75, z).cyl(0.025, 0.025, 1.3, 0x5a4a3a, x - 0.55, y, z).cyl(0.025, 0.025, 1.3, 0x5a4a3a, x + 0.55, y, z).box(1.2, 0.04, 0.04, 0x5a4a3a, x, y + 1.28, z);
        g.add(new THREE.ConeGeometry(0.22, 0.45, 7), 0xffa64a, x, y + 0.3, z).ball(0.25, 0xffc9e0, x, y + 0.9, z, 1, 0.25, 1, 1); break;
      case 'chest': k.box(0.9, 0.55, 0.6, 0xb06a4a, x, y, z).box(0.94, 0.2, 0.64, 0xc07a56, x, y + 0.55, z).box(0.96, 0.05, 0.66, 0xffd27a, x, y + 0.72, z).box(0.14, 0.18, 0.04, 0xffd27a, x, y + 0.45, z + 0.32); break;
    }
  }
  private rebuildStations() {
    for (const m of [this.stationMesh, this.ghostMesh]) if (m) { m.parent?.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    const k = new Kit(), g = new Kit(), gh = new Kit();
    for (const [id, p] of Object.entries(CAMP)) {
      if (id === 'board') continue;
      const built = id === 'table' || !!this.world.stations?.[id];
      if (built) this.station(k, g, id, p.x, p.z); else { const tg = new Kit(); this.station(gh, tg, id, p.x, p.z); tg.parts.forEach((x) => x.dispose()); }
    }
    const glow = g.parts.length ? new THREE.Mesh(g.build(), basic(0xffffff, { vertexColors: true })) : null;
    this.stationMesh = new THREE.Mesh(k.build(), mat()); if (glow) this.stationMesh.add(glow);
    this.streamer.groups.prairie.add(this.stationMesh);
    this.ghostMesh = gh.parts.length ? new THREE.Mesh(gh.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false })) : null;
    if (this.ghostMesh) this.streamer.groups.prairie.add(this.ghostMesh);
  }
  private rebuildDecor() {
    disposeTree(this.decorMesh); this.decorMesh.clear();
    const k = new Kit(), g = new Kit();
    for (const d of Object.values(this.world.decor ?? {})) if (d && d.s === 'over') addDecor(k, g, d);
    if (k.parts.length) this.decorMesh.add(new THREE.Mesh(k.build(), mat()));
    if (g.parts.length) this.decorMesh.add(new THREE.Mesh(g.build(), basic(0xffffff, { vertexColors: true })));
  }

  /* ---------------- butterflies & fireflies ---------------- */
  private buildLife() {
    const r = rand(3);
    const wing = () => new Kit().add(new THREE.CircleGeometry(0.12, 6), 0xffffff, -0.1, 0, 0, -Math.PI / 2, 0, 0.3).add(new THREE.CircleGeometry(0.12, 6), 0xffffff, 0.1, 0, 0, -Math.PI / 2, 0, -0.3).build();
    const spec: [BiomeId, number, number[]][] = [['prairie', 10, [0xffd27a, 0x9fd8ff, 0xff9ec4, 0xffffff, 0xb9a3e8]], ['sakura', 5, [0xffffff, 0xffc8dc]], ['azure', 6, [0x9affff, 0xfff0a0]], ['lagoon', 3, [0x9fd8ff, 0xffffff]]];
    for (const [b, n, cols] of spec) {
      const B = BIOMES[b], mesh = new THREE.InstancedMesh(wing(), basic(0xffffff, { side: THREE.DoubleSide, vertexColors: true }), n);
      for (let i = 0; i < n; i++) {
        let cx = 0, cz = 0;
        for (let t = 0; t < 20; t++) { cx = B.cx + (r() - 0.5) * (b === 'prairie' ? 36 : B.r * 1.4); cz = B.cz + (r() - 0.5) * (b === 'prairie' ? 36 : B.r * 1.4); if (landInfo(cx, cz).L > 3 && waterAt(cx, cz) === null) break; }
        this.bugs.push({ x: cx, y: 1, z: cz, a: r() * 6, cx, cz, gone: 0, biome: b });
        mesh.setColorAt(i, this.col.set(cols[i % cols.length]));
      }
      mesh.frustumCulled = false; this.streamer.groups[b].add(mesh); this.flies.set(b, mesh);
    }
  }

  /* ---------------- the house on the plot ---------------- */
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
    const k = new Kit(), glow = new Kit(), top = new Map<string, number>();
    for (const c of rooms) top.set(`${c.gx},${c.gz}`, Math.max(top.get(`${c.gx},${c.gz}`) ?? 0, c.lv));
    for (const c of rooms) {
      const [x, z] = cellPos(c), R = ROOMS[c.type], y = 0.3 + c.lv * 2.2, w = CELL - 0.3, wall = this.world.paint?.[c.id]?.wall ?? R.wall;
      k.box(w, 2.2, w, wall, x, y, z).box(w + 0.1, 0.25, w + 0.1, 0xfff1f6, x, y, z);
      glow.box(0.7, 0.7, 0.05, 0xfff0b0, x - 0.8, y + 0.9, z + w / 2 + 0.01).box(0.7, 0.7, 0.05, 0xfff0b0, x + 0.8, y + 0.9, z + w / 2 + 0.01).box(0.05, 0.7, 0.7, 0xfff0b0, x + w / 2 + 0.01, y + 0.9, z);
      if (top.get(`${c.gx},${c.gz}`) === c.lv) {
        const roof = new THREE.ConeGeometry(w * 0.78, 1.5, 4); roof.rotateY(Math.PI / 4);
        k.add(roof, ['greenhouse', 'pool', 'observatory'].includes(c.type) ? 0xbfeef0 : 0xff8fb8, x, y + 2.95, z);
        if (c.type === 'rooftop') k.cyl(0.05, 0.05, 0.8, 0x8a5a3c, x + 1.2, y + 2.2, z + 1.2);
      }
      this.blocks.push({ x, z, h: y + 2.2 });
    }
    const front = rooms.filter((c) => c.lv === 0 && c.gx === 0).sort((a, b) => b.gz - a.gz)[0] ?? rooms.find((c) => c.lv === 0)!;
    const [fx, fz] = cellPos(front), dz = fz + (CELL - 0.3) / 2;
    k.box(1.0, 1.55, 0.12, 0x9a6a46, fx, 0.3, dz + 0.03).ball(0.06, 0xffd27a, fx + 0.3, 1.1, dz + 0.12);
    this.door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.9), new THREE.MeshBasicMaterial({ map: softDot(), color: 0xffc7a0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.door.position.set(fx, 1.1, dz + 0.15);
    this.doorPos = [fx, dz + 0.9];
    this.house.add(new THREE.Mesh(k.build(), seeThrough(mat())), new THREE.Mesh(glow.build(), basic(0xffffff, { vertexColors: true })), this.door);
    const lab = labelSprite('Enter', '#FFD27A', 0.9, false); lab.position.set(fx, 2.3, dz + 0.2); this.house.add(lab);
  }

  private rebuildCables() {
    if (this.cableLines) { this.cableLines.parent?.remove(this.cableLines); this.cableLines.geometry.dispose(); (this.cableLines.material as THREE.Material).dispose(); }
    this.cableIds = Object.keys(this.world.cables ?? {});
    if (!this.cableIds.length) { this.cableLines = null; return; }
    const pts: number[] = [];
    for (const id of this.cableIds) {
      const a = ANCHORS.find((x) => x.id === id); if (!a) continue;
      const ay = H(a.x, a.z) + 2.4, by = H(HOPPER.x, HOPPER.z) + 1.7;
      for (let i = 0; i < 24; i++) for (const t of [i / 24, (i + 1) / 24]) pts.push(THREE.MathUtils.lerp(a.x, HOPPER.x + 0.5, t), THREE.MathUtils.lerp(ay, by, t) - Math.sin(t * Math.PI) * 1.1, THREE.MathUtils.lerp(a.z, HOPPER.z + 0.5, t));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.cableLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9 }));
    this.streamer.groups.prairie.add(this.cableLines);
  }

  setWorld(w: WorldDoc, E?: EngineAPI) {
    const prev = this.world;
    this.world = w;
    const planted = Object.entries(w.planted ?? {}).slice(0, 20), slots = this.nodes.filter((n) => n.kind === 'planted');
    slots.forEach((n, i) => { const p = planted[i]; if (p) { n.id = p[0]; n.x = p[1].x; n.z = p[1].z; n.y = H(n.x, n.z); n.s = 0.9; } else n.id = ''; });
    if (JSON.stringify(prev.rooms) !== JSON.stringify(w.rooms) || JSON.stringify(prev.paint) !== JSON.stringify(w.paint)) this.rebuildHouse();
    if (JSON.stringify(prev.cables) !== JSON.stringify(w.cables)) this.rebuildCables();
    if (JSON.stringify(prev.stations) !== JSON.stringify(w.stations)) this.rebuildStations();
    if (JSON.stringify(prev.decor) !== JSON.stringify(w.decor)) this.rebuildDecor();
    this.ruins.setWorld(w, E);
    for (const s of this.sets) s.dirty = true;
    this.refreshNodes(true);
  }

  spawn(who: Who): [number, number, number] { const x = who === 'shaurya' ? -0.7 : 0.7; return [x, H(x, 6), 6]; }

  ground(x: number, z: number, y: number) {
    if (this.ruins.blocked(x, z, y)) return null;
    let best: number | null = null;
    const pf = this.ruins.platformAt(x, z, y); if (pf) best = pf.h;
    for (const f of FOOTBRIDGES) { const h = platformH(f, x, z); if (h !== null && h <= y + 0.65 && (best === null || h > best)) best = h; }
    const t = sampleTerrain(x, z);
    if (t.L < -0.2) return best;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r - 0.2 || Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.r - 0.2 || t.h < -0.95) return best;
    const now = Date.now();
    for (const n of this.grid.near(x, z, 1.7, this.tmp)) {
      const K = KINDS[n.kind]; if (!K.col || this.isDown(n, now)) continue;
      if (Math.hypot(x - n.x, z - n.z) < K.col * (K.giant ? 1 : n.s)) return best;
    }
    for (const n of this.nodes) if (n.kind === 'planted' && n.id && !this.isDown(n, now) && Math.hypot(x - n.x, z - n.z) < 0.25) return best;
    if (Math.abs(x) < 16 && Math.abs(z) < 16) {
      for (const b of this.blocks) if (Math.abs(x - b.x) < CELL / 2 && Math.abs(z - b.z) < CELL / 2) return best;
      if (Math.abs(x - HOPPER.x) < 0.7 && Math.abs(z - HOPPER.z) < 0.7) return best;
      if (Math.hypot(x - NEST.x, z - NEST.z) < 1.1) return best;
      for (const [id, p] of Object.entries(CAMP)) if ((id === 'table' || id === 'board' || this.world.stations?.[id]) && Math.hypot(x - p.x, z - p.z) < (id === 'board' ? 0.5 : 0.72)) return best;
    }
    return best === null || t.h > best ? t.h : best;
  }
  surface(x: number, z: number, y: number): Surface {
    const pf = this.ruins.platformAt(x, z, y + 0.1); if (pf && Math.abs(pf.h - y) < 0.2) return pf.s;
    for (const f of FOOTBRIDGES) { const h = platformH(f, x, z); if (h !== null && Math.abs(h - y) < 0.2) return 'wood'; }
    const wl = waterAt(x, z); if (wl !== null && y < wl - 0.04) return 'water';
    return this.ruins.surface(x, z) ?? BIOMES[biomeAt(x, z)[0]].surface;
  }

  interactables(px: number, pz: number, _py: number, E: EngineAPI): Interactable[] {
    const out: Interactable[] = [], now = Date.now(), near = (x: number, z: number, d = 3.5) => Math.abs(px - x) < d && Math.abs(pz - z) < d;
    for (const n of [...this.grid.near(px, pz, 4, this.tmp), ...this.nodes.filter((p) => p.kind === 'planted' && p.id)]) {
      if (!n.id || this.isDown(n, now) || !near(n.x, n.z)) continue;
      const K = KINDS[n.kind];
      if (n.kind === 'planted') {
        const p = this.world.planted?.[n.id];
        if (p && now - p.at > 90_000) out.push({ id: n.id, x: n.x, z: n.z, r: 1.2, label: 'Chop', icon: '🪓', tool: 'hatchet' });
        else out.push({ id: 'water:' + n.id, x: n.x, z: n.z, r: 1.1, label: 'Water sapling', icon: '💧', tool: 'can', needs: 'can' });
        continue;
      }
      if (K.giant) { const hp = this.world.giants?.[n.id]?.hp ?? 0; out.push({ id: n.id, x: n.x, z: n.z, r: K.col + 1.3, label: `${K.label} ${hp}/${K.hp}`, icon: K.icon, tool: K.tool, needs: K.needs, hint: 'giant' }); continue; }
      out.push({ id: n.id, x: n.x, z: n.z, r: Math.max(1.2, K.col + 0.9), label: K.label, icon: K.icon, tool: K.tool, needs: K.needs, minTier: K.minTier });
    }
    this.bugs.forEach((b, i) => b.gone < now && near(b.x, b.z, 2.5) && out.push({ id: 'bug' + i, x: b.x, z: b.z, r: 1.7, label: b.biome === 'azure' ? 'Catch firefly' : 'Catch', icon: '🦋', tool: 'net', needs: 'net' }));
    if ([[1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3], [0, 0]].some(([dx, dz]) => waterAt(px + dx, pz + dz) !== null && sampleTerrain(px + dx, pz + dz).h < -0.08)) out.push({ id: 'fish', x: px, z: pz, r: 9, label: 'Fish', icon: '🎣', tool: 'rod', needs: 'rod' });
    if (near(0, 0, 18)) {
      for (const [id, p] of Object.entries(CAMP)) {
        const B = BLOCKS[id as keyof typeof BLOCKS], built = id === 'table' || id === 'board' || !!this.world.stations?.[id];
        out.push({ id: id === 'board' ? 'board' : `station:${id}`, x: p.x, z: p.z, r: 1.6, label: built ? B.name : `${B.name} (craft it)`, icon: B.icon, hint: 'important' });
      }
      out.push({ id: 'hopper', x: HOPPER.x, z: HOPPER.z, r: 1.6, label: 'Resource Hopper', icon: '📦' });
      out.push({ id: 'nest', x: NEST.x, z: NEST.z, r: 2, label: 'Pet Nest', icon: '🐾', hint: 'important' });
      for (const a of ANCHORS) out.push({ id: 'anchor:' + a.id, x: a.x, z: a.z, r: 1.6, label: this.world.cables?.[a.id] ? 'Sky-Cable ✓' : 'Build Sky-Cable', icon: '🚡' });
      if (this.doorPos) out.push({ id: 'door', x: this.doorPos[0], z: this.doorPos[1], r: 1.5, label: 'Enter', icon: '🚪', hint: 'important' });
      const rooms = Object.keys(this.world.rooms ?? {}).length;
      out.push({ id: 'plot', x: rooms ? PLOT.x + 3.2 : PLOT.x, z: rooms ? PLOT.z + 7 : PLOT.z + 1.5, r: rooms ? 1.5 : 3.2, label: rooms ? 'Expand house' : 'Build first room', icon: '🏡', hint: 'important' });
    }
    for (const s of this.sniffs) if (s.until > now) out.push({ id: 'sniff', x: s.x, z: s.z, r: 1.4, label: 'Dig crystal', icon: '✨' });
    for (const [id, d] of Object.entries(this.world.decor ?? {})) if (d && d.s === 'over' && near(d.x, d.z, 1.4)) out.push({ id: 'decor:' + id, x: d.x, z: d.z, r: 1.0, label: `Pick up ${item(d.item).name}`, icon: item(d.item).icon });
    this.ruins.interactables(px, pz, out, E);
    return out;
  }

  interact(id: string, E: EngineAPI) {
    const now = Date.now();
    if (this.ruins.interact(id, E)) return;
    const n = this.nodes.find((x) => x.id === id);
    if (n) return this.harvest(n, E);
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
        E.fx('splash', E.player.x + 1, -0.1, E.player.z + 1, 16); E.sound('splash');
        const luck = 0.62 + E.tier('rod') * 0.08 + (E.synergy() > 1 ? 0.1 : 0);
        if (Math.random() < luck) E.give(biomeAt(E.player.x, E.player.z)[0] === 'lagoon' && Math.random() < 0.3 ? { fish: E.synergy(), pearl: 1 } : { fish: E.synergy() }, E.player.x, E.player.y + 1, E.player.z, 'koi');
        else E.toast('🎣 The koi got away', 'So close!');
      }, 1600);
      return;
    }
    if (id === 'sniff') { const s = this.sniffs.find((x) => x.until > now); if (s) s.until = 0; E.play('pat', 0.6); E.fx('crystal', E.player.x, E.player.y + 0.3, E.player.z, 20); E.give({ crystal: 1 }, E.player.x, E.player.y + 1, E.player.z, 'hidden crystal'); return; }
    if (id === 'door') return E.enter();
    if (id === 'plot') return E.ui('build');
    if (id === 'board') return E.ui('quests');
    if (id.startsWith('station:')) {
      const s = id.slice(8), B = BLOCKS[s as keyof typeof BLOCKS];
      if (s !== 'table' && !this.world.stations?.[s]) { E.toast(`${B.icon} ${B.name} isn't built yet`, 'Craft it at the Crafting Table → Building tab. It appears right here.'); return; }
      E.sound(s === 'chest' ? 'chest' : 'open');
      return E.ui(s === 'chest' ? 'keepsakes' : 'station', s);
    }
    if (id === 'nest') return E.ui('pets');
    if (id.startsWith('decor:')) {
      const did = id.slice(6), d = this.world.decor?.[did]; if (!d) return;
      E.sound('pop'); E.patch({ [`decor.${did}`]: null }, { [`inv.${d.item}`]: 1 }); E.toast(`${item(d.item).icon} Picked up`, 'It is back in the shared pouch');
      return;
    }
    if (id === 'hopper') { const c = Object.keys(this.world.cables ?? {}).length; E.toast('📦 Resource Hopper', c ? `${c} Sky-Cable${c > 1 ? 's' : ''} zipping resources in automatically` : 'Build Sky-Cables at the grove posts to fill it automatically'); return; }
    if (id.startsWith('anchor:')) {
      const a = ANCHORS.find((x) => x.id === id.slice(7))!;
      if (this.world.cables?.[a.id]) { E.toast(`🚡 ${a.label} cable`, `Zips +1 ${a.res} into the hopper every 40s while you are both here`); return; }
      if (!canAfford(this.world.inv, CABLE_COST)) { E.toast('Need more materials', `Sky-Cable costs ${costText(CABLE_COST)}`); return; }
      E.patch({ [`cables.${a.id}`]: { at: now, by: E.me } }, negate(CABLE_COST)); E.sound('build'); E.fx('gold', a.x, 2.4, a.z, 30);
      E.toast('🚡 Sky-Cable built!', `${a.label} → Resource Hopper`);
    }
  }

  private harvest(n: Node, E: EngineAPI) {
    const K = KINDS[n.kind], now = Date.now(), ex = n.x, ey = n.y + 1, ez = n.z;
    if (K.giant) {
      if (!E.partnerAt.here || Math.hypot(E.partnerAt.x - n.x, E.partnerAt.z - n.z) > K.col + 5) { E.toast(`${K.icon} Too big for one!`, `Bring ${E.partnerName}: link the tether and swing in rhythm together`); return; }
      E.swing(); n.wob = 0.35; this.dirty(n);
      setTimeout(() => { E.hitStop(60); E.shake(0.16); E.fx(K.fx as any, ex, n.y + (K.tree ? 4 : 1.5), ez, 18); E.sound(K.snd); }, 110);
      E.coop.hit(n.id);
      return;
    }
    const tool = K.tool, strong = !!tool && E.toolFor(tool), tier = tool && strong ? E.tier(tool) : 0;
    if (K.hp <= 1) {
      E.play('pat', 0.5); E.fx(K.fx as any, ex, n.y + 0.4, ez, 14); E.sound(K.snd);
      E.patch({ [`nodes.${n.id}`]: now + K.respawn }, {}); this.drop(n, E, 1);
      return;
    }
    E.swing(); n.wob = 0.35; this.dirty(n);
    setTimeout(() => {
      E.hitStop(60 + tier * 8); E.shake(0.1);
      E.fx(K.fx as any, ex, n.y + (K.tree ? 1.7 : 0.5), ez, 14 + tier * 3); E.sound(K.snd);
      if (tier > 0) E.fx('star', ex, n.y + 1, ez, tier * 3);
      n.hp += strong ? 2 + tier : 1;
      if (n.hp >= K.hp) {
        n.hp = 0;
        if (n.kind === 'planted') E.patch({ [`planted.${n.id}.at`]: now }, {});
        else E.patch({ [`nodes.${n.id}`]: now + K.respawn });
        this.drop(n, E, strong ? 1 + (tier >= 3 ? 0.5 : 0) : 0.5);
        E.fx('gold', ex, ey, ez, 18);
      }
    }, 110);
  }
  private drop(n: Node, E: EngineAPI, mult: number) {
    const K = KINDS[n.kind], res: Record<string, number> = {};
    for (const [k, v] of Object.entries(K.drops)) res[k] = Math.max(1, Math.round((v ?? 1) * mult)) * E.synergy();
    for (const [k, p] of K.bonus ?? []) if (Math.random() < p) res[k] = (res[k] ?? 0) + 1;
    E.give(res, n.x, n.y + 1, n.z);
  }
  private dirty(n: Node) { const s = this.sets.find((x) => x.biome === n.biome && x.kind === n.kind); if (s) s.dirty = true; }
  /** one synced co-op hit on a giant node (called on the phone that completed the pair) */
  giantHit(id: string, E: EngineAPI) {
    const n = this.nodes.find((x) => x.id === id); if (!n) return;
    E.patch({}, { [`giants.${id}.hp`]: 1 });
    E.fx('heart', n.x, n.y + 2.5, n.z, 6); E.sound('chime');
  }

  plantAt(x: number, z: number) {
    if (biomeAt(x, z)[0] !== 'prairie' || landInfo(x, z).L < 2 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.2 || Math.hypot(x - PLOT.x, z - PLOT.z) < 7) return false;
    if (Object.values(CAMP).some((c) => Math.hypot(x - c.x, z - c.z) < 1.8)) return false;
    return this.nodes.every((n) => !n.id || Math.hypot(n.x - x, n.z - z) > 1.4) && Object.keys(this.world.planted ?? {}).length < 20;
  }
  sniff(x: number, z: number) { this.sniffs = [{ x, z, until: Date.now() + 25_000 }]; }
  sniffMark() { return this.sniffs.find((x) => x.until > Date.now()) ?? null; }

  update(dt: number, t: number, E: EngineAPI) {
    this.uTime.value = t;
    const P = E.player, now = Date.now();
    this.streamer.update(P.x, P.z, t);
    this.ruins.update(dt, t, E);
    // biome tracking (with a little hysteresis) + soft sky/fog blend
    const [b, w] = biomeAt(P.x, P.z); if (b !== this.biome && w > 0.62) this.biome = b;
    if ((this.skyT -= dt) <= 0) { this.skyT = 0.25; this.blendSky(P.x, P.z); }
    const k = 1 - Math.exp(-1.6 * dt);
    this.fogC.lerp(this.fogTarget, k); (this.scene.fog as THREE.Fog).color.copy(this.fogC);
    this.near += (this.nearT - this.near) * k; this.far += (this.farT - this.far) * k;
    (this.scene.fog as THREE.Fog).near = this.near; (this.scene.fog as THREE.Fog).far = this.far;
    let skyMoved = false;
    this.skyNow.forEach((c, i) => { const before = c.r + c.g + c.b; c.lerp(this.skyTarget[i], k); if (Math.abs(c.r + c.g + c.b - before) > 0.002) skyMoved = true; });
    if (skyMoved) this.paintSky();
    // butterflies / fireflies flutter in figure-eights
    const idx = new Map<BiomeId, number>();
    for (const bug of this.bugs) {
      const mesh = this.flies.get(bug.biome)!, i = idx.get(bug.biome) ?? 0; idx.set(bug.biome, i + 1);
      if (!mesh.parent?.visible) continue;
      bug.a += dt * 0.7;
      bug.x = bug.cx + Math.sin(bug.a) * 2.2; bug.z = bug.cz + Math.sin(bug.a * 2) * 1.2; bug.y = H(bug.x, bug.z) + 0.9 + Math.sin(t * 3 + i) * 0.25;
      const flap = 0.3 + Math.abs(Math.sin(t * 14 + i)) * 0.9;
      this.m4.compose(this.v.set(bug.x, bug.y, bug.z), this.q.setFromEuler(this.e.set(0, bug.a + Math.PI / 2, 0)), this.s3.set(bug.gone > now ? 0.0001 : flap, 1, 1));
      mesh.setMatrixAt(i, this.m4);
    }
    this.flies.forEach((m) => { if (m.parent?.visible) m.instanceMatrix.needsUpdate = true; });
    if (this.streamer.groups.prairie.visible) {
      for (let i = 0; i < 5; i++) {
        const a = t * (0.3 + i * 0.05) + i * 1.3, rr = 1 + i * 0.4;
        this.m4.compose(this.v.set(POND.x + Math.cos(a) * rr, -0.22, POND.z + Math.sin(a) * rr), this.q.setFromEuler(this.e.set(0, -a, 0)), this.s3.setScalar(1));
        this.koi.setMatrixAt(i, this.m4);
      }
      this.koi.instanceMatrix.needsUpdate = true;
    }
    // hit wobble + periodic respawn refresh (visible biomes only)
    for (const n of this.nodes) if (n.wob > 0) { n.wob = Math.max(0, n.wob - dt); this.dirty(n); }
    if ((this.refT += dt) > 2) { this.refT = 0; for (const s of this.sets) if (this.streamer.groups[s.biome].visible) s.dirty = true; }
    if (this.sets.some((s) => s.dirty)) this.refreshNodes();
    if (this.door) (this.door.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 3) * 0.2;
    // Sky-Cable packets glide to the hopper; the host phone is the single source of truth for income
    let pi = 0;
    for (const id of this.cableIds) {
      const a = ANCHORS.find((x) => x.id === id); if (!a) continue;
      for (let j = 0; j < 3 && pi < 12; j++, pi++) {
        const tt = (t * 0.12 + j / 3) % 1, ay = H(a.x, a.z) + 2.4, by = H(HOPPER.x, HOPPER.z) + 1.7;
        this.m4.makeTranslation(THREE.MathUtils.lerp(a.x, HOPPER.x + 0.5, tt), THREE.MathUtils.lerp(ay, by, tt) - Math.sin(tt * Math.PI) * 1.1 - 0.15, THREE.MathUtils.lerp(a.z, HOPPER.z + 0.5, tt));
        this.packets.setMatrixAt(pi, this.m4);
      }
    }
    for (; pi < 12; pi++) this.packets.setMatrixAt(pi, this.m4.makeScale(0, 0, 0));
    this.packets.instanceMatrix.needsUpdate = true;
    if (E.host && this.cableIds.length && now - this.lastIncome > 40_000) {
      if (this.lastIncome) {
        const inc: Record<string, number> = {};
        for (const id of this.cableIds) { const a = ANCHORS.find((x) => x.id === id); if (a) inc[`inv.${a.res}`] = (inc[`inv.${a.res}`] ?? 0) + 1; }
        E.patch({}, inc); E.fx('gold', HOPPER.x, 1.8, HOPPER.z, 12);
      }
      this.lastIncome = now;
    }
    if (E.host) {
      // giants: the host grants the loot once both of you landed enough synced hits
      for (const g of GIANTS) {
        const st = this.world.giants?.[g.id], K = KINDS[g.kind];
        if ((st?.hp ?? 0) >= K.hp && !((st?.down ?? 0) > now)) {
          E.patch({ [`giants.${g.id}`]: { hp: 0, down: now + K.respawn } }, E.quest('giant'));
          const res: Record<string, number> = {}; for (const [kk, v] of Object.entries(K.drops)) res[kk] = v ?? 1;
          E.give(res, g.x, H(g.x, g.z) + 3, g.z, 'giant');
          E.toast(`${K.icon} You brought it down together!`, 'A giant co-op harvest for the shared vault');
          this.world = { ...this.world, giants: { ...this.world.giants, [g.id]: { hp: 0, down: now + K.respawn } } };
        }
      }
      // daily "visit all five biomes together"
      const day = dayKey(), pb = E.partnerAt.here ? biomeAt(E.partnerAt.x, E.partnerAt.z)[0] : null;
      if (pb === this.biome && !this.world.visits?.[day]?.[this.biome]) {
        E.patch({ [`visits.${day}.${this.biome}`]: true }, E.quest('visit'));
        this.world = { ...this.world, visits: { ...this.world.visits, [day]: { ...this.world.visits?.[day], [this.biome]: true } } };
      }
    }
  }
  keyDone(id: string, E: EngineAPI) { this.ruins.keyDone(id, E); }
  coopHint(P: { x: number; z: number }) { return this.ruins.coopHint(P); }
  partnerKey(id: string) { this.ruins.partnerKey(id); }

  dispose() { disposeTree(this.scene); this.skyTex.dispose(); }
}
