// Peaceful Sky-style ruins scattered through the biomes. Each one is sealed by twin floor runes: both of you must
// stand on them at once (or hold hands between them) to unseal it. Inside: a Two-Key Treasure Chest (both turn a key
// within 3 s), Lore Memory Stones and an Ancient Blueprint Scroll. Two exploration puzzles open hidden places:
// twin braziers lit within 3 s raise the Spirit-Bridge to the Wind-Bell Sanctuary, and a light-beam anchor lets one
// of you cross the lagoon while the other channels it, until the lever lowers a permanent wooden bridge.
import * as THREE from 'three';
import { HILL, KNOLL, LAGOON, SHRINE, SKY, heightAt, platformH, type BiomeId, type Platform, type Surface } from '../data/biomes';
import { BLUEPRINT_FROM, LORE, dayKey } from '../data/craftingRegistry';
import { ROOMS, item, type Cost, type RoomType } from './catalog';
import { Kit, basic, labelSprite, mat, seeThrough, softDot } from './gfx';
import type { EngineAPI, Interactable, WorldDoc } from './types';

type XZ = [number, number];
interface Ring { x: number; z: number; r0: number; r1: number; gap: number; half: number }
interface Box { x: number; z: number; hw: number; hl: number }
interface Def {
  id: string; biome: BiomeId; name: string; x: number; z: number; y: number;
  runes?: [XZ, XZ]; chest: XZ; lore: XZ[]; scroll?: XZ; itemY?: number;
  loot: Cost; first: Cost; ring?: Ring; veilBox?: Box; solids: [number, number, number][]; platforms: Platform[]; stone?: [number, number, number];
  build: (k: Kit, g: Kit) => void;
}
const H = (x: number, z: number) => heightAt(x, z);
const pol = (cx: number, cz: number, a: number, r: number): XZ => [cx + Math.cos(a) * r, cz + Math.sin(a) * r];

function defs(): Def[] {
  // ---- Overgrown Cloud-Temple Ruins (prairie hill) ----
  const T: XZ = [HILL.x - 1, HILL.z + 1], gapT = Math.atan2(-T[1], -T[0]), ty = H(T[0], T[1]) + 0.05;
  const temple: Def = {
    id: 'temple', biome: 'prairie', name: 'Overgrown Cloud-Temple', x: T[0], z: T[1], y: ty,
    runes: [pol(T[0], T[1], gapT + 0.32, 5.5), pol(T[0], T[1], gapT - 0.32, 5.5)], chest: T, lore: [pol(T[0], T[1], gapT + 2.1, 2.3), pol(T[0], T[1], gapT - 2.1, 2.3)], scroll: pol(T[0], T[1], gapT + Math.PI, 2.2),
    loot: { gem: 1, star: 1, roseOre: 2, crystal: 1 }, first: { gem: 2, star: 2, roseOre: 3 }, ring: { x: T[0], z: T[1], r0: 3.2, r1: 4.2, gap: gapT, half: 0.42 }, solids: [[T[0], T[1], 0.8]], platforms: [], stone: [T[0], T[1], 4.3],
    build: (k, g) => {
      for (let i = 0; i < 14; i++) {
        const a = gapT + 0.55 + (i / 14) * (Math.PI * 2 - 1.1), [x, z] = pol(T[0], T[1], a, 3.7), y = H(x, z), h = [2.6, 1.2, 2.2, 0.7, 2.6, 1.8, 0.5, 2.4, 1.4, 2.6, 0.9, 2.0, 2.6, 1.5][i];
        k.cyl(0.32, 0.36, h, 0xe6e0ea, x, y - 0.1, z, 8).ball(0.36, 0x8fc98a, x, y + h - 0.05, z, 1.1, 0.45, 1.1);
        if (i % 3 === 1) k.add(new THREE.DodecahedronGeometry(0.28, 0), 0xd8d2de, x + 0.6, y + 0.1, z + 0.3, i, i, 0, 1, 0.6, 1);
      }
      for (const s of [-1, 1]) {                               // the broken entrance arch
        const [x, z] = pol(T[0], T[1], gapT + s * 0.47, 3.75), y = H(x, z);
        k.cyl(0.36, 0.4, 3.0, 0xece6f0, x, y - 0.1, z, 8).box(0.9, 0.3, 0.9, 0xece6f0, x, y + 2.9, z);
      }
      const [ax, az] = pol(T[0], T[1], gapT + 0.47, 3.75), [bx, bz] = pol(T[0], T[1], gapT - 0.47, 3.75);
      k.add(new THREE.BoxGeometry(1.8, 0.35, 0.7), 0xece6f0, ax + (bx - ax) * 0.3, H(ax, az) + 3.2, az + (bz - az) * 0.3, 0, -Math.atan2(bz - az, bx - ax), 0.2);
      for (let i = 0; i < 9; i++) { const [x, z] = pol(T[0], T[1], i * 0.7, 1.2 + (i % 3) * 0.9); k.add(new THREE.BoxGeometry(1.1, 0.12, 1.1), 0xd8d2e4, x, ty - 0.02, z, 0, i * 0.4, 0); }
      k.box(1.5, 0.75, 1.1, 0xd8d0e4, T[0], ty, T[1]).box(1.7, 0.12, 1.3, 0xece6f0, T[0], ty + 0.75, T[1]).ball(0.35, 0x8fc98a, T[0] - 0.6, ty + 0.85, T[1] + 0.4, 1, 0.4, 1);
      g.add(new THREE.RingGeometry(1.9, 2.15, 32), 0xfff0b0, T[0], ty + 0.06, T[1], -Math.PI / 2);
    },
  };
  // ---- Sunken Sakura Shrine (half-submerged torii pavilion) ----
  const S: XZ = [SHRINE.x, SHRINE.z];
  const shrine: Def = {
    id: 'shrine', biome: 'sakura', name: 'Sunken Sakura Shrine', x: S[0], z: S[1], y: 0.16, itemY: 0.16,
    runes: [[S[0] - 1.8, S[1] + 6.2], [S[0] + 1.8, S[1] + 6.2]], chest: [S[0], S[1] - 1.1], lore: [[S[0] + 1.4, S[1] - 0.3], [S[0], S[1] + 1.3]], scroll: [S[0] - 1.4, S[1] - 0.3],
    loot: { gem: 1, star: 1, silk: 2, pinkQuartz: 1 }, first: { gem: 2, star: 2, silk: 3, pinkQuartz: 2 }, veilBox: { x: S[0], z: S[1] + 4.9, hw: 1.0, hl: 0.65 }, solids: [],
    platforms: [{ id: 'shrineDeck', x: S[0], z: S[1], r: 2.15, h0: 0.16, surface: 'wood' }, { id: 'shrineWalk', x: S[0], z: S[1] + 3.95, hw: 0.72, hl: 2.05, h0: 0.16, h1: 0.2, surface: 'wood' }],
    build: (k, g) => {
      k.cyl(2.15, 2.15, 0.1, 0xc98f6a, S[0], 0.06, S[1], 24);
      for (let i = 0; i < 7; i++) k.box(1.44, 0.08, 0.52, 0xc98f6a, S[0], 0.12 + i * 0.006, S[1] + 2.2 + i * 0.58);
      for (const [dx, dz] of [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]]) k.cyl(0.07, 0.07, 2.1, 0xd9485f, S[0] + dx, 0.16, S[1] + dz);
      k.add(new THREE.ConeGeometry(2.2, 0.9, 4), 0x6b2547, S[0], 2.65, S[1], 0, Math.PI / 4).box(2.4, 0.12, 2.4, 0x8a2f4f, S[0], 2.2, S[1]);
      const tz = S[1] + 3.0;                                    // the torii, its posts standing in the water
      for (const s of [-1, 1]) k.cyl(0.13, 0.15, 3.2, 0xe23b55, S[0] + s * 1.15, -0.7, tz);
      k.box(3.3, 0.18, 0.26, 0xe23b55, S[0], 1.9, tz).add(new THREE.BoxGeometry(3.9, 0.2, 0.34), 0x2b0f1f, S[0], 2.45, tz, 0, 0, 0).box(0.16, 0.5, 0.16, 0xe23b55, S[0], 1.95, tz);
      for (let i = 0; i < 9; i++) {                              // glowing lotus lanterns on the water
        const [x, z] = pol(S[0], S[1], (i / 9) * Math.PI * 2 + 0.3, 3.55);
        if (Math.abs(x - S[0]) < 1.2 && z > S[1]) continue;
        k.add(new THREE.CylinderGeometry(0.34, 0.3, 0.04, 8), 0x7cc47f, x, -0.1, z);
        for (let p = 0; p < 6; p++) k.add(new THREE.ConeGeometry(0.09, 0.26, 4), 0xffb3d4, x + Math.cos(p) * 0.12, -0.02, z + Math.sin(p) * 0.12, Math.cos(p) * 0.5, 0, Math.sin(p) * 0.5);
        g.ball(0.11, 0xffd9a0, x, 0.1, z, 1, 1, 1, 1);
      }
    },
  };
  // ---- Abandoned Azure Treehouse & Observatory (on the knoll) ----
  const K: XZ = [KNOLL.x, KNOLL.z], ky = H(K[0], K[1]), deck = ky + 2.1, rb = H(K[0], K[1] + 8.4) + 0.06;
  const tree: Def = {
    id: 'treehouse', biome: 'azure', name: 'Azure Treehouse & Observatory', x: K[0], z: K[1], y: deck, itemY: deck,
    runes: [[K[0] - 1.9, K[1] + 9.5], [K[0] + 1.9, K[1] + 9.5]], chest: [K[0] + 1.55, K[1] + 1.3], lore: [[K[0] - 1.9, K[1] - 0.9], [K[0] - 0.2, K[1] - 2.25]], scroll: [K[0] - 1.6, K[1] + 1.4],
    loot: { gem: 1, star: 1, moonstone: 1, sap: 2 }, first: { gem: 2, star: 2, moonstone: 2, sap: 3 }, veilBox: { x: K[0], z: K[1] + 7.7, hw: 1.05, hl: 1.0 },
    solids: [[K[0], K[1], 0.6], [K[0] - 2.4, K[1] + 1.6, 0.18], [K[0] + 2.4, K[1] + 1.6, 0.18], [K[0] - 2.4, K[1] - 1.6, 0.18], [K[0] + 2.4, K[1] - 1.6, 0.18]],
    platforms: [{ id: 'treeDeck', x: K[0], z: K[1], r: 2.95, h0: deck, surface: 'wood' }, { id: 'treeRamp', x: K[0], z: K[1] + 5.6, hw: 0.78, hl: 2.85, h0: deck, h1: rb, surface: 'wood' }],
    build: (k, g) => {
      k.cyl(0.55, 0.85, 7.2, 0x3b3f8f, K[0], ky - 0.2, K[1], 10);
      g.cyl(0.57, 0.6, 0.2, 0x6fe3ff, K[0], ky + 1.2, K[1], 10).cyl(0.57, 0.6, 0.2, 0x8ab4ff, K[0], ky + 3.6, K[1], 10);
      for (let i = 0; i < 6; i++) k.ball(1.6 - i * 0.12, 0x5b5fc7 + i * 0x050208, K[0] + Math.cos(i * 1.4) * 1.3, ky + 6.4 + (i % 3) * 0.7, K[1] + Math.sin(i * 1.4) * 1.3, 1, 0.8, 1);
      k.cyl(2.95, 2.95, 0.16, 0xa8744f, K[0], deck - 0.16, K[1], 20);
      for (const [dx, dz] of [[-2.4, 1.6], [2.4, 1.6], [-2.4, -1.6], [2.4, -1.6]]) k.cyl(0.13, 0.13, deck - H(K[0] + dx, K[1] + dz) + 0.1, 0x8a5a3c, K[0] + dx, H(K[0] + dx, K[1] + dz) - 0.1, K[1] + dz);
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; if (Math.abs(a - Math.PI / 2) < 0.35) continue; const [x, z] = pol(K[0], K[1], a, 2.85); k.cyl(0.04, 0.04, 0.7, 0x8a5a3c, x, deck, z); }
      k.add(new THREE.TorusGeometry(2.85, 0.04, 4, 32), 0x8a5a3c, K[0], deck + 0.7, K[1], Math.PI / 2);
      for (let i = 0; i < 8; i++) {                              // the ramp + its spiral railing
        const t = (i + 0.5) / 8, z = K[1] + 2.75 + t * 5.7, y = deck + (rb - deck) * t;
        k.box(1.5, 0.1, 0.7, 0xa8744f, K[0], y - 0.12, z);
        for (const s of [-1, 1]) k.cyl(0.035, 0.035, 0.6, 0x8a5a3c, K[0] + s * 0.78, y - 0.1, z);
      }
      // broken brass telescope + dusty bookshelves
      k.cyl(0.25, 0.32, 0.3, 0x7d5a3c, K[0] + 1.6, deck, K[1] - 1.2).add(new THREE.CylinderGeometry(0.1, 0.16, 1.3, 10), 0xe0b25a, K[0] + 1.75, deck + 0.75, K[1] - 1.35, 0.6, 0, -0.9);
      k.box(1.4, 1.5, 0.4, 0x8a5a3c, K[0] - 1.9, deck, K[1] - 1.35, 0.5);
      for (let i = 0; i < 9; i++) k.box(0.12, 0.34, 0.28, [0x9ad8ff, 0xffb3d4, 0xfff07a, 0xb6a6ff][i % 4], K[0] - 2.35 + (i % 5) * 0.2, deck + 0.2 + Math.floor(i / 5) * 0.55, K[1] - 1.15, 0.5);
      g.ball(0.12, 0xfff0b0, K[0] + 0.8, deck + 1.6, K[1] + 2.0, 1, 1, 1, 0).ball(0.12, 0xfff0b0, K[0] - 1.0, deck + 1.6, K[1] + 2.2, 1, 1, 1, 0);
    },
  };
  // ---- Forgotten Wind-Bell Sanctuary (hidden sky island) ----
  const I: XZ = [SKY.x, SKY.z - 1], iy = H(I[0], I[1]) + 0.04, sb = H(SKY.x, -73.0);
  const bells: Def = {
    id: 'bells', biome: 'cliffs', name: 'Forgotten Wind-Bell Sanctuary', x: I[0], z: I[1], y: iy,
    runes: [[I[0] - 1.6, I[1] + 4.5], [I[0] + 1.6, I[1] + 4.5]], chest: I, lore: [[I[0] - 1.7, I[1] - 0.9], [I[0] + 1.7, I[1] - 0.9]], scroll: [I[0], I[1] - 1.9],
    loot: { gem: 1, star: 1, shard: 2, skyQuartz: 1 }, first: { gem: 3, star: 3, shard: 4, skyQuartz: 2 }, ring: { x: I[0], z: I[1], r0: 2.6, r1: 3.5, gap: Math.PI / 2, half: 0.5 }, solids: [[I[0], I[1], 0.6]], platforms: [], stone: [I[0], I[1], 3.6],
    build: (k, g) => {
      for (let i = 0; i < 9; i++) {
        const a = Math.PI / 2 + 0.6 + (i / 9) * (Math.PI * 2 - 1.2), [x, z] = pol(I[0], I[1], a, 3.05), y = H(x, z), h = 3.4 + (i % 3) * 0.5;
        k.cyl(0.3, 0.38, h, 0xd8cfe8, x, y - 0.1, z, 8).box(0.9, 0.16, 0.3, 0xe6dff0, x, y + h - 0.1, z, -a);
        g.ball(0.17, 0xfff0a0, x, y + h - 0.55, z, 1, 1.3, 1, 1);
      }
      k.cyl(0.07, 0.07, 2.6, 0x8a5a3c, I[0] - 0.9, iy, I[1]).cyl(0.07, 0.07, 2.6, 0x8a5a3c, I[0] + 0.9, iy, I[1]).box(2.0, 0.12, 0.12, 0x8a5a3c, I[0], iy + 2.6, I[1]);
      k.add(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), 0xe0b25a, I[0], iy + 2.0, I[1]);
      k.cyl(1.0, 1.1, 0.5, 0xd8cfe8, I[0], iy - 0.05, I[1], 12);
    },
  };
  // ---- Pearl Grotto (lagoon islet: light-beam + lever puzzle) ----
  const G: XZ = [LAGOON.x, LAGOON.z];
  const grotto: Def = {
    id: 'grotto', biome: 'lagoon', name: 'Pearl Grotto', x: G[0], z: G[1], y: H(G[0], G[1]),
    chest: [G[0] - 0.9, G[1] + 0.9], lore: [[G[0] + 1.0, G[1] + 1.1]], loot: { gem: 1, star: 1, pearl: 2, seaGlass: 2 }, first: { gem: 2, star: 2, pearl: 4, seaGlass: 3 }, solids: [], platforms: [],
    build: (k, g) => {
      const y = H(G[0], G[1]);
      k.add(new THREE.SphereGeometry(1.4, 12, 8, 0, Math.PI * 1.3, 0, Math.PI / 2), 0xf4e1ea, G[0] + 0.3, y - 0.05, G[1] + 1.8, 0, 2.4, 0, 1.2, 0.9, 1);
      g.ball(0.18, 0xffffff, G[0] + 0.4, y + 0.3, G[1] + 1.5, 1, 1, 1, 1);
    },
  };
  return [temple, shrine, tree, bells, grotto];
}

const BRAZIERS: XZ[] = [[SKY.x - 4, -71.2], [SKY.x + 4, -71.2]];
const SPIRIT: Platform = { id: 'spirit', x: SKY.x, z: -77.2, hw: 1.1, hl: 4.2, h0: 0, h1: 0, arc: 0.25, surface: 'wood' };
const ANCHOR: XZ = [LAGOON.x - 4.6, LAGOON.z - 11.8], LEVER: XZ = [LAGOON.x + 1.1, LAGOON.z - 1.1];
const LBRIDGE: Platform = { id: 'lagoonBridge', x: LAGOON.x, z: LAGOON.z - 6.05, hw: 1.0, hl: 4.65, h0: 0.26, h1: 0.4, arc: 0.28, surface: 'wood' };

export class Structures {
  defs = defs();
  private runeMesh = new Map<string, THREE.Mesh[]>(); private veil = new Map<string, THREE.Mesh>(); private lid = new Map<string, THREE.Mesh>();
  private flames: THREE.Mesh[] = []; private spiritMesh!: THREE.Mesh; private beamMesh!: THREE.Mesh; private woodMesh!: THREE.Mesh; private anchorGlow!: THREE.Mesh; private leverArm!: THREE.Mesh;
  private world: WorldDoc = {}; private runeT = new Map<string, number>(); private beam = false; private litMine = 0; private litTheirs = 0;
  private seen = new Set<string>();

  constructor(private groups: Record<BiomeId, THREE.Group>) {
    SPIRIT.h0 = heightAt(SKY.x, SPIRIT.z - SPIRIT.hl!) + 0.05; SPIRIT.h1 = heightAt(SKY.x, SPIRIT.z + SPIRIT.hl!) + 0.05;
    const ring = new THREE.RingGeometry(0.5, 0.78, 24); ring.rotateX(-Math.PI / 2);
    for (const d of this.defs) {
      const k = new Kit(), g = new Kit();
      d.build(k, g);
      for (const [x, z] of d.runes ?? []) k.cyl(0.85, 0.9, 0.08, 0xd8d0e4, x, H(x, z) - 0.02, z, 16);
      // the chest: a body in the static mesh, the lid animates
      const [cx, cz] = d.chest, cy = (d.itemY ?? H(cx, cz)) + (d.id === 'temple' ? 0.87 : 0);
      k.box(0.8, 0.45, 0.55, 0xb06a4a, cx, cy, cz).box(0.84, 0.06, 0.59, 0xffd27a, cx, cy + 0.2, cz);
      for (const [x, z] of d.lore) { const y = d.itemY ?? H(x, z); k.add(new THREE.DodecahedronGeometry(0.32, 0), 0x9aa0c4, x, y + 0.3, z, 0.3, 0.6, 0, 0.8, 1.2, 0.5); g.ball(0.07, 0x9ad8ff, x, y + 0.55, z + 0.17, 1, 1, 1, 0); }
      if (d.scroll) { const [x, z] = d.scroll, y = d.itemY ?? H(x, z); k.cyl(0.2, 0.26, 0.7, 0xd8d0e4, x, y, z, 8); g.add(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8), 0xfff6d8, x, y + 0.8, z, 0, 0, Math.PI / 2); }
      const G = this.groups[d.biome];
      if (k.parts.length) G.add(new THREE.Mesh(k.build(), seeThrough(mat())));
      if (g.parts.length) G.add(new THREE.Mesh(g.build(), seeThrough(basic(0xffffff, { vertexColors: true }))));
      const lid = new THREE.Mesh(new Kit().box(0.84, 0.18, 0.59, 0xc07a56, 0, 0, -0.29).box(0.86, 0.04, 0.61, 0xffd27a, 0, 0.18, -0.29).build(), mat());
      lid.position.set(cx, cy + 0.45, cz + 0.29); G.add(lid); this.lid.set(d.id, lid);
      const runes = (d.runes ?? []).map(([x, z]) => { const m = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.set(x, H(x, z) + 0.09, z); G.add(m); return m; });
      this.runeMesh.set(d.id, runes);
      if (d.ring || d.veilBox) {
        const v = d.ring ? new THREE.Mesh(new THREE.CylinderGeometry(d.ring.r1 - 0.25, d.ring.r1 - 0.25, 3, 20, 1, true, Math.PI / 2 - d.ring.gap - d.ring.half, d.ring.half * 2), this.veilMat())
          : new THREE.Mesh(new THREE.PlaneGeometry(d.veilBox!.hw * 2, 2.6), this.veilMat());
        if (d.ring) v.position.set(d.ring.x, d.y + 1.4, d.ring.z); else v.position.set(d.veilBox!.x, (d.itemY ?? H(d.veilBox!.x, d.veilBox!.z)) + 1.3, d.veilBox!.z + d.veilBox!.hl * 0.6);
        G.add(v); this.veil.set(d.id, v);
      }
      const lab = labelSprite(d.name, '#B6A6FF', 1.35, false); lab.position.set(d.x, d.y + (d.id === 'treehouse' ? 5.6 : 4.2), d.z); G.add(lab);
    }
    // twin braziers + the Spirit-Bridge
    const ck = new Kit();
    for (const [x, z] of BRAZIERS) { const y = H(x, z); ck.cyl(0.18, 0.28, 0.9, 0x9a8bc4, x, y, z, 8).cyl(0.45, 0.3, 0.3, 0x7d6fa8, x, y + 0.9, z, 10); }
    this.groups.cliffs.add(new THREE.Mesh(ck.build(), mat()));
    for (const [x, z] of BRAZIERS) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 8), new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.9 })); f.position.set(x, H(x, z) + 1.55, z); f.visible = false; this.groups.cliffs.add(f); this.flames.push(f); }
    this.spiritMesh = this.planks(SPIRIT, 0xe6dcff, 0.82, true); this.groups.cliffs.add(this.spiritMesh);
    // lagoon: anchor pad, light bridge, wooden bridge, lever
    const ay = H(ANCHOR[0], ANCHOR[1]), lk = new Kit().cyl(0.9, 0.95, 0.1, 0xf4e1ea, ANCHOR[0], ay - 0.02, ANCHOR[1], 18).cyl(0.12, 0.16, 1.2, 0xe8d6dc, ANCHOR[0], ay, ANCHOR[1] - 1.1);
    const ly = H(LEVER[0], LEVER[1]); lk.box(0.5, 0.35, 0.4, 0x8a5a3c, LEVER[0], ly, LEVER[1]);
    this.groups.lagoon.add(new THREE.Mesh(lk.build(), mat()));
    this.anchorGlow = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.anchorGlow.scale.setScalar(1.15); this.anchorGlow.position.set(ANCHOR[0], ay + 0.1, ANCHOR[1]); this.groups.lagoon.add(this.anchorGlow);
    this.beamMesh = this.planks(LBRIDGE, 0xfff6c8, 0.55, true); this.woodMesh = this.planks(LBRIDGE, 0xc98f6a, 1, false);
    this.groups.lagoon.add(this.beamMesh, this.woodMesh);
    this.leverArm = new THREE.Mesh(new Kit().cyl(0.04, 0.04, 0.7, 0x5a3f2b).ball(0.09, 0xff3e8a, 0, 0.72, 0).build(), mat());
    this.leverArm.position.set(LEVER[0], ly + 0.35, LEVER[1]); this.groups.lagoon.add(this.leverArm);
  }
  private veilMat() { return new THREE.MeshBasicMaterial({ color: 0xb6d6ff, map: softDot(), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); }
  private planks(p: Platform, color: number, opacity: number, glow: boolean) {
    const k = new Kit(), N = 11;
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N, z = p.z - p.hl! + t * p.hl! * 2, y = p.h0 + (p.h1! - p.h0) * t + Math.sin(t * Math.PI) * (p.arc ?? 0) - 0.06;
      k.box(p.hw! * 2, 0.08, (p.hl! * 2) / N - 0.05, color, p.x, y, z);
      if (!glow && i % 2 === 0) for (const s of [-1, 1]) k.cyl(0.04, 0.04, 0.5, 0x8a5a3c, p.x + s * p.hw!, y, z);
    }
    const m = new THREE.Mesh(k.build(), glow ? new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }) : mat());
    m.visible = false; return m;
  }

  setWorld(w: WorldDoc, E?: EngineAPI) {
    const prev = this.world; this.world = w;
    const day = dayKey();
    for (const d of this.defs) {
      const open = !!w.ruins?.[d.id] || !d.runes;
      const v = this.veil.get(d.id); if (v) v.visible = !open;
      const lid = this.lid.get(d.id)!; lid.rotation.x = w.chests?.[d.id] === day ? -1.9 : 0;
      if (E && w.ruins?.[d.id] && !prev.ruins?.[d.id] && this.seen.has('init')) {
        E.sound('bell'); E.sound('unlock', { delay: 0.3 }); E.fx('star', d.x, d.y + 1.5, d.z, 40); E.shake(0.15);
        E.toast(`✨ ${d.name} unsealed!`, 'You opened it together. Look inside: a chest, lore stones and a scroll.');
      }
      if (E && w.chests?.[d.id] === day && prev.chests?.[d.id] !== day && this.seen.has('init')) { E.sound('chest'); E.sound('coins', { delay: 0.25 }); E.fx('gold', d.chest[0], (d.itemY ?? H(...d.chest)) + 1, d.chest[1], 30); }
    }
    if (E && w.bridges?.sky && !prev.bridges?.sky && this.seen.has('init')) { E.sound('bell'); E.sound('shimmer'); E.toast('🌉 The Spirit-Bridge appeared!', 'It leads to the hidden Wind-Bell Sanctuary'); }
    if (E && w.bridges?.lagoon && !prev.bridges?.lagoon && this.seen.has('init')) { E.sound('build'); E.toast('🌉 Wooden bridge lowered', 'The Pearl Grotto is open to both of you now'); }
    this.spiritMesh.visible = !!w.bridges?.sky;
    this.woodMesh.visible = !!w.bridges?.lagoon;
    this.leverArm.rotation.z = w.bridges?.lagoon ? -0.9 : 0.5;
    this.seen.add('init');
  }

  /** extra walkable surfaces (decks, walkways, bridges) that exist right now */
  platforms(): Platform[] {
    const out: Platform[] = [];
    for (const d of this.defs) out.push(...d.platforms);
    if (this.world.bridges?.sky) out.push(SPIRIT);
    if (this.world.bridges?.lagoon || this.beam) out.push(LBRIDGE);
    return out;
  }
  platformAt(x: number, z: number, y: number): { h: number; s: Surface } | null {
    let best: { h: number; s: Surface } | null = null;
    for (const p of this.platforms()) { const h = platformH(p, x, z); if (h !== null && h <= y + 0.65 && (!best || h > best.h)) best = { h, s: p.surface }; }
    return best;
  }
  /** pillars, sealed veils and ring walls */
  blocked(x: number, z: number, y: number) {
    for (const d of this.defs) {
      if (Math.abs(x - d.x) > 12 || Math.abs(z - d.z) > 12) continue;
      for (const [sx, sz, r] of d.solids) if (Math.hypot(x - sx, z - sz) < r && y < d.y + 2.5 && y > d.y - 2.5) return true;
      const sealed = !!d.runes && !this.world.ruins?.[d.id];
      if (d.ring) {
        const R = d.ring, dist = Math.hypot(x - R.x, z - R.z);
        if (dist > R.r0 && dist < R.r1) {
          let da = Math.atan2(z - R.z, x - R.x) - R.gap; da = Math.atan2(Math.sin(da), Math.cos(da));
          if (Math.abs(da) > R.half || sealed) return true;
        }
      }
      if (sealed && d.veilBox && Math.abs(x - d.veilBox.x) < d.veilBox.hw && Math.abs(z - d.veilBox.z) < d.veilBox.hl) return true;
    }
    return false;
  }
  surface(x: number, z: number): Surface | null {
    for (const d of this.defs) if (d.stone && Math.hypot(x - d.stone[0], z - d.stone[1]) < d.stone[2]) return 'stone';
    return null;
  }

  interactables(px: number, pz: number, out: Interactable[], E: EngineAPI) {
    const day = dayKey(), w = this.world;
    for (const d of this.defs) {
      if (Math.abs(px - d.x) > 14 || Math.abs(pz - d.z) > 14) continue;
      const open = !!w.ruins?.[d.id] || !d.runes, y = d.itemY;
      if (d.runes && !open) {
        const [a, b] = d.runes, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        out.push({ id: `rune:${d.id}`, x: mx, z: mz, r: 3.2, label: 'Stand on both runes', icon: '🔷', hint: `You on one rune, ${E.partnerName} on the other` });
        continue;
      }
      const opened = w.chests?.[d.id] === day, kw = E.coop.waiting(`chest:${d.id}`), pw = E.coop.partnerWaiting(`chest:${d.id}`);
      out.push({ id: `chest:${d.id}`, x: d.chest[0], z: d.chest[1], y, r: 1.6, icon: opened ? '✅' : '🗝️',
        label: opened ? 'Opened today' : kw ? `Waiting for ${E.partnerName}…` : pw ? `${E.partnerName} turned a key — turn yours!` : 'Turn your key' });
      d.lore.forEach(([x, z], i) => out.push({ id: `lore:${d.id}:${i}`, x, z, y, r: 1.3, icon: '🪨', label: 'Read the memory stone' }));
      if (d.scroll) out.push({ id: `scroll:${d.id}`, x: d.scroll[0], z: d.scroll[1], y, r: 1.3, icon: '📜', label: Object.entries(BLUEPRINT_FROM).some(([r, s]) => s === d.id && !w.bp?.[r]) ? 'Take the blueprint scroll' : 'Blueprint copied ✓' });
    }
    if (Math.abs(px - SKY.x) < 12 && pz < -62 && pz > -76) {
      BRAZIERS.forEach(([x, z], i) => out.push({ id: `brazier:${i}`, x, z, r: 1.5, icon: '🔥', label: w.bridges?.sky ? 'The bridge is up ✓' : E.coop.partnerWaiting('brazier') ? 'Light it now!' : 'Light the brazier' }));
    }
    if (Math.hypot(px - ANCHOR[0], pz - ANCHOR[1]) < 3) out.push({ id: 'beam', x: ANCHOR[0], z: ANCHOR[1], r: 1.2, icon: '✨', label: w.bridges?.lagoon ? 'Bridge is built ✓' : 'Channel the light' });
    if (Math.hypot(px - LEVER[0], pz - LEVER[1]) < 3) out.push({ id: 'lever', x: LEVER[0], z: LEVER[1], r: 1.3, icon: '🎚️', label: w.bridges?.lagoon ? 'Bridge lowered ✓' : 'Pull the lever' });
  }

  interact(id: string, E: EngineAPI): boolean {
    const [kind, sid, idx] = id.split(':'), d = this.defs.find((x) => x.id === sid), w = this.world;
    if (kind === 'rune') { E.toast('🔷 Twin runes', `Stand on one glowing rune while ${E.partnerName} stands on the other (or hold hands between them).`); return true; }
    if (kind === 'chest' && d) {
      if (w.chests?.[d.id] === dayKey()) { E.toast('✅ Already opened today', 'It refills with new treasure tomorrow'); return true; }
      E.play('pat', 0.6); E.sound('latch'); E.coop.key(`chest:${d.id}`);
      return true;
    }
    if (kind === 'lore' && d) {
      const L = LORE[d.id]?.[Number(idx)]; if (!L) return true;
      E.sound('book'); E.ui('lore', { ...L, where: d.name });
      if (!w.lore?.[`${d.id}:${idx}`]) E.patch({ [`lore.${d.id}:${idx}`]: Date.now() });
      return true;
    }
    if (kind === 'scroll' && d) {
      const rooms = (Object.entries(BLUEPRINT_FROM) as [RoomType, string][]).filter(([, s]) => s === d.id).map(([r]) => r);
      const fresh = rooms.filter((r) => !w.bp?.[r]);
      if (!fresh.length) { E.toast('📜 Already copied', rooms.map((r) => ROOMS[r].name).join(' · ')); return true; }
      E.sound('scroll'); E.play('pat', 0.6); E.fx('spark', E.player.x, E.player.y + 1.2, E.player.z, 20);
      E.patch(Object.fromEntries(fresh.map((r) => [`bp.${r}`, true])));
      E.toast('📜 Ancient Blueprint Scroll!', `Unlocked: ${fresh.map((r) => `${ROOMS[r].icon} ${ROOMS[r].name}`).join(', ')} — build them with the hammer`);
      return true;
    }
    if (kind === 'brazier') {
      if (w.bridges?.sky) { E.toast('🌉 The Spirit-Bridge is up', 'Cross it to the Wind-Bell Sanctuary'); return true; }
      E.play('cast', 0.8); E.sound('sizzle'); this.litMine = performance.now(); E.coop.key('brazier');
      return true;
    }
    if (kind === 'beam') { E.toast('✨ Light-beam anchor', `Stand here to hold the light bridge while ${E.partnerName} crosses, then they pull the lever.`); return true; }
    if (kind === 'lever') {
      if (!w.bridges?.lagoon) { E.sound('latch'); E.sound('build', { delay: 0.2 }); E.patch({ 'bridges.lagoon': Date.now() }); E.shake(0.1); }
      return true;
    }
    return false;
  }

  /** a two-key action completed (on the phone that grants it) */
  keyDone(id: string, E: EngineAPI) {
    if (id === 'brazier') { E.patch({ 'bridges.sky': Date.now() }); return; }
    const d = this.defs.find((x) => `chest:${x.id}` === id); if (!d) return;
    const first = !this.world.chests?.[`${d.id}First`], loot = { ...(first ? d.first : d.loot) } as Record<string, number>;
    E.patch({ [`chests.${d.id}`]: dayKey(), [`chests.${d.id}First`]: 1 }, E.quest('chest'));
    E.give(loot, d.chest[0], (d.itemY ?? H(...d.chest)) + 1.2, d.chest[1], 'treasure');
    E.toast('🗝️ Two keys, one treasure!', Object.entries(loot).map(([k, v]) => `${item(k).icon} ${v} ${item(k).name}`).join(' · '));
  }
  partnerKey(id: string) { if (id === 'brazier') this.litTheirs = performance.now(); }
  /** where a helper should stand to complete the puzzle the player is working on (solo-test bot) */
  coopHint(P: { x: number; z: number }): { x: number; z: number } | null {
    for (const d of this.defs) {
      if (!d.runes || this.world.ruins?.[d.id]) continue;
      const i = d.runes.findIndex(([x, z]) => Math.hypot(P.x - x, P.z - z) < 1.1);
      if (i >= 0) { const [x, z] = d.runes[1 - i]; return { x, z }; }
    }
    if (!this.world.bridges?.sky) { const i = BRAZIERS.findIndex(([x, z]) => Math.hypot(P.x - x, P.z - z) < 2.2); if (i >= 0) { const [x, z] = BRAZIERS[1 - i]; return { x: x + 0.9, z }; } }
    if (!this.world.bridges?.lagoon && Math.hypot(P.x - LAGOON.x, P.z - LAGOON.z) < 13 && Math.hypot(P.x - ANCHOR[0], P.z - ANCHOR[1]) > 2) return { x: ANCHOR[0], z: ANCHOR[1] };
    return null;
  }

  update(dt: number, t: number, E: EngineAPI) {
    const P = E.player, Q = E.partnerAt, now = performance.now();
    for (const d of this.defs) {
      const G = this.groups[d.biome]; if (!G.visible) continue;
      const v = this.veil.get(d.id); if (v?.visible) (v.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(t * 2) * 0.15;
      if (!d.runes) continue;
      const open = !!this.world.ruins?.[d.id], ms = this.runeMesh.get(d.id)!;
      const on = d.runes.map(([x, z]) => [Math.hypot(P.x - x, P.z - z) < 0.9, Q.here && Math.hypot(Q.x - x, Q.z - z) < 0.9]);
      ms.forEach((m, i) => { const mat = m.material as THREE.MeshBasicMaterial; const lit = open || on[i][0] || on[i][1]; mat.color.setHex(open ? 0xfff0a0 : lit ? 0xffffff : 0x9ad8ff); mat.opacity = lit ? 0.9 : 0.35 + Math.sin(t * 2 + i) * 0.15; m.scale.setScalar(lit ? 1.15 + Math.sin(t * 6) * 0.05 : 1); });
      if (open) continue;
      const mx = (d.runes[0][0] + d.runes[1][0]) / 2, mz = (d.runes[0][1] + d.runes[1][1]) / 2;
      const both = (on[0][0] && on[1][1]) || (on[1][0] && on[0][1]) || (E.holding() && Q.here && Math.hypot(P.x - mx, P.z - mz) < 3 && Math.hypot(Q.x - mx, Q.z - mz) < 3);
      if (both) {
        const held = (this.runeT.get(d.id) ?? 0) + dt; this.runeT.set(d.id, held);
        if (Math.random() < dt * 20) E.fx('spark', mx, d.y + 0.5, mz, 2);
        if (held > 1.1 && E.host) { this.runeT.set(d.id, -99); E.patch({ [`ruins.${d.id}`]: Date.now() }, E.quest('unseal')); }
      } else this.runeT.set(d.id, 0);
    }
    // braziers glow while lit (3 s window), lagoon light bridge while someone channels the anchor
    if (this.groups.cliffs.visible) {
      const up = !!this.world.bridges?.sky;
      this.flames.forEach((f, i) => { const lit = up || now - (i === 0 ? this.litMine : this.litTheirs) < 3000 || now - (i === 0 ? this.litTheirs : this.litMine) < 3000; f.visible = lit; f.scale.set(1, 0.85 + Math.sin(t * 12 + i) * 0.15, 1); });
    }
    const chan = Math.hypot(P.x - ANCHOR[0], P.z - ANCHOR[1]) < 0.95 || (Q.here && Math.hypot(Q.x - ANCHOR[0], Q.z - ANCHOR[1]) < 0.95);
    this.beam = !this.world.bridges?.lagoon && chan;
    this.beamMesh.visible = this.beam;
    if (this.beam) (this.beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 5) * 0.12;
    (this.anchorGlow.material as THREE.MeshBasicMaterial).opacity = this.world.bridges?.lagoon ? 0.15 : chan ? 0.95 : 0.35 + Math.sin(t * 2) * 0.12;
  }
}
