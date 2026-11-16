// Harvestable resource nodes for all five biomes: what they look like, what they drop and which tool they need.
// Each kind renders as 1-3 InstancedMeshes inside its biome's streamed group.
import * as THREE from 'three';
import { Kit } from './gfx';
import type { BiomeId } from '../data/biomes';
import type { ItemId, ToolId } from '../data/items';

export type NodeKindId =
  | 'birch' | 'cherry' | 'rock' | 'crystal' | 'flower' | 'planted'
  | 'sakura' | 'silkbush' | 'pquartz' | 'nectar' | 'giantSakura'
  | 'azure' | 'mushroom' | 'sapvine' | 'moonrock' | 'geode'
  | 'shardrock' | 'skyquartz' | 'cotton' | 'meteor'
  | 'seaglass' | 'pearl' | 'drift' | 'clay' | 'sandpile';

export interface Part { geo: () => THREE.BufferGeometry; glow?: boolean; wind?: number; stump?: boolean; palette?: number[] }
export interface NodeKind {
  label: string; icon: string; tool?: ToolId; needs?: ToolId; minTier?: number;
  hp: number; drops: Partial<Record<ItemId, number>>; bonus?: [ItemId, number][]; respawn: number;
  col: number; fx: string; snd: string; tree?: boolean; giant?: boolean; parts: Part[]; scale: [number, number];
}

const trunk = (h: number, r0: number, r1: number) => () => new Kit().cyl(r0, r1, h, 0xffffff).build();
const blob = (spec: [number, number, number, number, number?][], flat = 0.85) => () => {
  const k = new Kit(); for (const [r, x, y, z, sy] of spec) k.ball(r, 0xffffff, x, y, z, 1, sy ?? flat, 1, 1); return k.build();
};
const stump = () => new Kit().cyl(0.17, 0.2, 0.22, 0xb98a63).cyl(0.15, 0.15, 0.02, 0xf2d6b0, 0, 0.22).build();
const rockGeo = (c1: number, c2: number) => () => new Kit().add(new THREE.DodecahedronGeometry(0.55, 0), c1, 0, 0.3, 0, 0, 0, 0, 1.2, 0.8, 1).add(new THREE.DodecahedronGeometry(0.3, 0), c2, 0.5, 0.15, 0.2).build();
const xtal = (a: number, b: number, c: number, base = 0xb7b0c8) => () => new Kit()
  .add(new THREE.OctahedronGeometry(0.32, 0), a, 0, 0.55, 0, 0, 0, 0, 0.7, 1.6, 0.7).add(new THREE.OctahedronGeometry(0.2, 0), b, 0.3, 0.3, 0.1, 0, 0, 0.5, 0.7, 1.4, 0.7)
  .add(new THREE.OctahedronGeometry(0.18, 0), c, -0.25, 0.25, -0.1, 0, 0, -0.4, 0.7, 1.4, 0.7).add(new THREE.DodecahedronGeometry(0.3, 0), base, 0, 0.05, 0, 0, 0, 0, 1.3, 0.4, 1.3).build();

export const KINDS: Record<NodeKindId, NodeKind> = {
  /* ---- Sunlit Prairie ---- */
  birch: { label: 'Chop', icon: '🪓', tool: 'hatchet', hp: 4, drops: { wood: 2 }, respawn: 90_000, col: 0.3, fx: 'leaf', snd: 'chop', tree: true, scale: [0.85, 1.25],
    parts: [{ geo: trunk(1.3, 0.11, 0.17), palette: [0xf4f1ea] }, { geo: blob([[0.75, 0, 1.75, 0], [0.55, 0.45, 1.45, 0.2], [0.5, -0.4, 1.5, -0.15]]), wind: 0.05, palette: [0x8fd694, 0x9fe0a0, 0x7fcf8a] }, { geo: stump, stump: true }] },
  cherry: { label: 'Chop', icon: '🪓', tool: 'hatchet', hp: 4, drops: { wood: 2 }, respawn: 90_000, col: 0.3, fx: 'blossom', snd: 'chop', tree: true, scale: [0.85, 1.25],
    parts: [{ geo: trunk(1.3, 0.11, 0.17), palette: [0x9b6b55] }, { geo: blob([[0.75, 0, 1.75, 0], [0.55, 0.45, 1.45, 0.2], [0.5, -0.4, 1.5, -0.15]]), wind: 0.05, palette: [0xffb7d0, 0xffc4da, 0xffa8c8] }, { geo: stump, stump: true }] },
  planted: { label: 'Chop', icon: '🪓', tool: 'hatchet', hp: 4, drops: { wood: 2 }, respawn: 0, col: 0.25, fx: 'leaf', snd: 'chop', tree: true, scale: [0.9, 0.9],
    parts: [{ geo: trunk(1.3, 0.11, 0.17), palette: [0x9b6b55] }, { geo: blob([[0.75, 0, 1.75, 0], [0.55, 0.45, 1.45, 0.2], [0.5, -0.4, 1.5, -0.15]]), wind: 0.05, palette: [0xffb7d0, 0x8fd694] }, { geo: stump, stump: true }] },
  rock: { label: 'Mine', icon: '⛏️', tool: 'pickaxe', hp: 4, drops: { stone: 2 }, bonus: [['roseOre', 0.3]], respawn: 100_000, col: 0.75, fx: 'stone', snd: 'clink', scale: [0.85, 1.25],
    parts: [{ geo: rockGeo(0xc9c3d6, 0xb7b0c8) }] },
  crystal: { label: 'Mine crystal', icon: '💎', tool: 'pickaxe', needs: 'pickaxe', hp: 4, drops: { crystal: 1 }, respawn: 150_000, col: 0.55, fx: 'crystal', snd: 'crystal', scale: [0.85, 1.25],
    parts: [{ geo: xtal(0xff7db5, 0xffb3d4, 0xf5a3c7) }] },
  flower: { label: 'Pick flowers', icon: '🌼', hp: 1, drops: { flower: 2 }, respawn: 60_000, col: 0, fx: 'blossom', snd: 'pick', scale: [0.85, 1.25],
    parts: [{ geo: () => { const k = new Kit(); for (let i = 0; i < 7; i++) k.cyl(0.015, 0.015, 0.3, 0x5aa86a, Math.cos(i) * 0.35, 0, Math.sin(i * 1.7) * 0.35).ball(0.1, [0xff7db5, 0xfff07a, 0xffffff][i % 3], Math.cos(i) * 0.35, 0.32, Math.sin(i * 1.7) * 0.35, 1, 0.7, 1, 0); return k.build(); }, wind: 0.3 }] },
  /* ---- Sakura Wind-Blossom Grove ---- */
  sakura: { label: 'Chop sakura', icon: '🌸', tool: 'hatchet', hp: 4, drops: { sakuraWood: 2 }, bonus: [['nectar', 0.25]], respawn: 90_000, col: 0.35, fx: 'blossom', snd: 'chop', tree: true, scale: [0.95, 1.35],
    parts: [{ geo: () => new Kit().cyl(0.13, 0.21, 1.7, 0xffffff).add(new THREE.CylinderGeometry(0.05, 0.08, 0.9, 6), 0xffffff, 0.35, 1.55, 0.05, 0, 0, -0.8).add(new THREE.CylinderGeometry(0.05, 0.08, 0.8, 6), 0xffffff, -0.32, 1.5, -0.05, 0, 0, 0.8).build(), palette: [0x7d4f45, 0x8a5a4a] },
      { geo: blob([[0.95, 0, 2.35, 0, 0.7], [0.72, 0.8, 2.1, 0.3, 0.7], [0.66, -0.75, 2.15, -0.25, 0.7], [0.55, 0.1, 2.85, -0.35, 0.7], [0.5, -0.25, 1.95, 0.75, 0.7]]), wind: 0.06, palette: [0xffb7d0, 0xffc8dc, 0xff9ec4, 0xffe0ec] }, { geo: stump, stump: true }] },
  silkbush: { label: 'Harvest silk', icon: '🎀', tool: 'sickle', needs: 'sickle', hp: 2, drops: { silk: 2 }, respawn: 80_000, col: 0.45, fx: 'blossom', snd: 'sickle', scale: [0.8, 1.15],
    parts: [{ geo: blob([[0.42, 0, 0.32, 0], [0.32, 0.36, 0.26, 0.12], [0.3, -0.34, 0.24, -0.1], [0.26, 0.05, 0.55, 0.2]], 0.8), wind: 0.12, palette: [0xffc6dc, 0xffd8e8, 0xf7b4cf] },
      { geo: () => { const k = new Kit(); for (let i = 0; i < 6; i++) k.ball(0.07, 0xffffff, Math.cos(i * 1.1) * 0.38, 0.45 + (i % 2) * 0.18, Math.sin(i * 1.1) * 0.32, 1, 0.6, 1, 0); return k.build(); }, glow: true, palette: [0xfff6fb] }] },
  pquartz: { label: 'Mine pink quartz', icon: '⛏️', tool: 'pickaxe', needs: 'pickaxe', minTier: 1, hp: 4, drops: { pinkQuartz: 1 }, bonus: [['stone', 0.5]], respawn: 140_000, col: 0.6, fx: 'crystal', snd: 'crystal', scale: [0.95, 1.3],
    parts: [{ geo: xtal(0xffd1e3, 0xffb3d4, 0xffe6f0, 0xd9b8c4) }] },
  nectar: { label: 'Gather nectar', icon: '🍒', hp: 1, drops: { nectar: 1 }, respawn: 70_000, col: 0.3, fx: 'blossom', snd: 'pick', scale: [0.85, 1.15],
    parts: [{ geo: blob([[0.34, 0, 0.3, 0], [0.26, 0.28, 0.26, 0.1], [0.24, -0.26, 0.24, -0.08]], 0.8), wind: 0.15, palette: [0x8fcf8a, 0x9fd99a] },
      { geo: () => { const k = new Kit(); for (let i = 0; i < 6; i++) k.ball(0.07, 0xffffff, Math.cos(i * 1.05) * 0.3, 0.42 + (i % 3) * 0.06, Math.sin(i * 1.05) * 0.28, 1, 1, 1, 0); return k.build(); }, palette: [0xe8335f, 0xff4f7a] }] },
  giantSakura: { label: 'Chop together', icon: '🌸', tool: 'hatchet', needs: 'hatchet', hp: 10, drops: { sakuraWood: 12, silk: 4, nectar: 3, gem: 1, star: 1 }, respawn: 20 * 60_000, col: 1.1, fx: 'blossom', snd: 'chopHeavy', giant: true, tree: true, scale: [1, 1],
    parts: [{ geo: () => new Kit().cyl(0.45, 0.75, 4.2, 0x7d4f45).add(new THREE.CylinderGeometry(0.16, 0.26, 2.6, 7), 0x7d4f45, 1.1, 3.9, 0.2, 0, 0, -0.9).add(new THREE.CylinderGeometry(0.16, 0.26, 2.4, 7), 0x7d4f45, -1.1, 3.8, -0.2, 0, 0, 0.9)
      .add(new THREE.TorusGeometry(0.9, 0.18, 6, 14), 0xc9a26b, 0, 0.5, 0, Math.PI / 2).build() },
      { geo: blob([[2.3, 0, 5.6, 0, 0.72], [1.7, 1.9, 5.0, 0.7, 0.72], [1.6, -1.9, 5.1, -0.6, 0.72], [1.3, 0.3, 6.7, -0.8, 0.72], [1.2, -0.6, 4.6, 1.8, 0.72], [1.1, 0.9, 4.6, -1.7, 0.72]]), wind: 0.03, palette: [0xffb7d0] }] },
  /* ---- Azure Whisper Woods ---- */
  azure: { label: 'Chop heartwood', icon: '🪓', tool: 'hatchet', hp: 4, drops: { azureWood: 2 }, bonus: [['sap', 0.25]], respawn: 90_000, col: 0.3, fx: 'spark', snd: 'chop', tree: true, scale: [0.95, 1.4],
    parts: [{ geo: trunk(2.7, 0.09, 0.16), glow: true, palette: [0x6fe3ff, 0x8ab4ff, 0x7ad9f0] },
      { geo: blob([[0.62, 0, 3.0, 0, 1.55], [0.46, 0.3, 2.3, 0.15, 1.3], [0.4, -0.28, 2.45, -0.12, 1.3]], 1.4), wind: 0.035, palette: [0x5b5fc7, 0x7a6fe0, 0x4a7fd6, 0x6a5acd] }, { geo: stump, stump: true }] },
  mushroom: { label: 'Harvest glow-moss', icon: '🍄', tool: 'sickle', needs: 'sickle', hp: 2, drops: { moss: 2 }, respawn: 80_000, col: 0.35, fx: 'spark', snd: 'sickle', scale: [0.8, 1.3],
    parts: [{ geo: () => new Kit().cyl(0.05, 0.07, 0.34, 0xe8f0ff).cyl(0.04, 0.05, 0.22, 0xe8f0ff, 0.28, 0, 0.12).cyl(0.035, 0.045, 0.18, 0xe8f0ff, -0.22, 0, -0.1).add(new THREE.CircleGeometry(0.42, 8), 0x3f9a8a, 0, 0.02, 0, -Math.PI / 2).build() },
      { geo: () => new Kit().ball(0.2, 0xffffff, 0, 0.36, 0, 1, 0.55, 1).ball(0.14, 0xffffff, 0.28, 0.23, 0.12, 1, 0.55, 1).ball(0.11, 0xffffff, -0.22, 0.19, -0.1, 1, 0.55, 1).build(), glow: true, palette: [0x6ff0ff, 0x9ad8ff, 0xb6a6ff] }] },
  sapvine: { label: 'Collect lumina sap', icon: '🧪', hp: 1, drops: { sap: 1 }, respawn: 75_000, col: 0.35, fx: 'spark', snd: 'bubbles', scale: [0.85, 1.15],
    parts: [{ geo: () => new Kit().cyl(0.22, 0.28, 0.4, 0x5a4a7a).cyl(0.2, 0.2, 0.02, 0x8a7aa8, 0, 0.4).build() },
      { geo: () => new Kit().ball(0.09, 0xffffff, 0.12, 0.5, 0.05, 1, 1.3, 1).ball(0.07, 0xffffff, -0.1, 0.46, 0.1, 1, 1.3, 1).ball(0.08, 0xffffff, 0.02, 0.55, -0.12, 1, 1.3, 1).build(), glow: true, palette: [0xffd27a, 0xffe6a0] }] },
  moonrock: { label: 'Mine moonstone', icon: '🌙', tool: 'pickaxe', needs: 'pickaxe', minTier: 2, hp: 4, drops: { moonstone: 1 }, bonus: [['stone', 0.5]], respawn: 150_000, col: 0.75, fx: 'crystal', snd: 'clink', scale: [0.9, 1.2],
    parts: [{ geo: rockGeo(0x8d93c4, 0x7a80b5) }, { geo: () => new Kit().add(new THREE.TorusGeometry(0.16, 0.05, 5, 10, Math.PI * 1.2), 0xffffff, 0.1, 0.72, 0.25, 0, 0, 0.6).ball(0.08, 0xffffff, -0.3, 0.5, 0.35, 1, 1, 1, 0).build(), glow: true, palette: [0xeaf4ff] }] },
  geode: { label: 'Mine together', icon: '💎', tool: 'pickaxe', needs: 'pickaxe', hp: 10, drops: { moonstone: 5, sap: 4, moss: 3, gem: 2, star: 1 }, respawn: 20 * 60_000, col: 1.6, fx: 'crystal', snd: 'clink', giant: true, scale: [1, 1],
    parts: [{ geo: () => new Kit().add(new THREE.DodecahedronGeometry(1.6, 1), 0x4d4f7a, 0, 0.9, 0, 0, 0, 0, 1.2, 0.75, 1.1).build() },
      { geo: () => { const k = new Kit(); for (let i = 0; i < 9; i++) { const a = i * 0.7; k.add(new THREE.OctahedronGeometry(0.4 + (i % 3) * 0.12, 0), 0xffffff, Math.cos(a) * 0.9, 1.4 + (i % 2) * 0.4, Math.sin(a) * 0.8, 0.2 * i, 0, 0.3 * Math.sin(i), 0.6, 1.8, 0.6); } return k.build(); }, glow: true, palette: [0x7fe8ff] }] },
  /* ---- Cloud-Reach Starlight Cliffs ---- */
  shardrock: { label: 'Mine starlight', icon: '🌟', tool: 'pickaxe', needs: 'pickaxe', hp: 4, drops: { shard: 1 }, bonus: [['stone', 0.6]], respawn: 120_000, col: 0.75, fx: 'gold', snd: 'crystal', scale: [0.9, 1.25],
    parts: [{ geo: rockGeo(0x9a8bc4, 0x8576b0) }, { geo: () => new Kit().add(new THREE.OctahedronGeometry(0.16, 0), 0xffffff, 0.15, 0.72, 0.2).add(new THREE.OctahedronGeometry(0.12, 0), 0xffffff, -0.25, 0.6, 0.3).add(new THREE.OctahedronGeometry(0.1, 0), 0xffffff, 0.45, 0.4, 0.3).build(), glow: true, palette: [0xfff0a0, 0xffe27a] }] },
  skyquartz: { label: 'Mine sky-quartz', icon: '⛏️', tool: 'pickaxe', needs: 'pickaxe', minTier: 2, hp: 4, drops: { skyQuartz: 1 }, respawn: 150_000, col: 0.6, fx: 'crystal', snd: 'crystal', scale: [0.95, 1.3],
    parts: [{ geo: xtal(0xe6dcff, 0xc9b6ff, 0xfff6ff, 0xa99bc4) }] },
  cotton: { label: 'Gather cloud-cotton', icon: '☁️', tool: 'sickle', needs: 'sickle', hp: 2, drops: { cotton: 2 }, respawn: 80_000, col: 0.3, fx: 'spark', snd: 'sickle', scale: [0.85, 1.2],
    parts: [{ geo: () => { const k = new Kit(); for (let i = 0; i < 5; i++) k.cyl(0.015, 0.02, 0.5 + (i % 2) * 0.15, 0x9aa06a, Math.cos(i * 1.3) * 0.22, 0, Math.sin(i * 1.3) * 0.22); return k.build(); }, wind: 0.2 },
      { geo: () => { const k = new Kit(); for (let i = 0; i < 5; i++) k.ball(0.13, 0xffffff, Math.cos(i * 1.3) * 0.22, 0.55 + (i % 2) * 0.15, Math.sin(i * 1.3) * 0.22, 1.2, 0.9, 1.2); return k.build(); }, wind: 0.2, palette: [0xffffff, 0xfff6fb] }] },
  meteor: { label: 'Mine together', icon: '☄️', tool: 'pickaxe', needs: 'pickaxe', hp: 10, drops: { shard: 8, skyQuartz: 3, cotton: 2, gem: 2, star: 1 }, respawn: 20 * 60_000, col: 1.5, fx: 'gold', snd: 'clink', giant: true, scale: [1, 1],
    parts: [{ geo: () => new Kit().add(new THREE.TorusGeometry(2.3, 0.55, 6, 18), 0xa99bc4, 0, 0.1, 0, Math.PI / 2, 0, 0, 1, 1, 0.45).add(new THREE.DodecahedronGeometry(1.25, 1), 0x3a2f5c, 0, 0.9, 0, 0.3, 0.2, 0).build() },
      { geo: () => { const k = new Kit(); for (let i = 0; i < 8; i++) { const a = i * 0.8; k.add(new THREE.OctahedronGeometry(0.25, 0), 0xffffff, Math.cos(a) * 0.85, 1.0 + Math.sin(i * 2) * 0.5, Math.sin(a) * 0.85); } return k.build(); }, glow: true, palette: [0xfff0a0] }] },
  /* ---- Crystal Dew Lagoon ---- */
  seaglass: { label: 'Pick up sea-glass', icon: '🧊', hp: 1, drops: { seaGlass: 1 }, respawn: 60_000, col: 0, fx: 'splash', snd: 'sparkle', scale: [0.9, 1.2],
    parts: [{ geo: () => { const k = new Kit(); for (let i = 0; i < 6; i++) k.add(new THREE.DodecahedronGeometry(0.08 + (i % 3) * 0.03, 0), 0xffffff, Math.cos(i * 1.2) * 0.25, 0.05, Math.sin(i * 1.2) * 0.25, i, i, 0, 1, 0.55, 1); return k.build(); }, glow: true, palette: [0x8ff0e6, 0xa8e6ff, 0xc8ffd8] }] },
  pearl: { label: 'Open the shell', icon: '🦪', hp: 1, drops: { pearl: 1 }, respawn: 90_000, col: 0, fx: 'splash', snd: 'pop', scale: [0.9, 1.2],
    parts: [{ geo: () => new Kit().add(new THREE.SphereGeometry(0.26, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xf4e1ea, 0, 0.02, 0, 0, 0, 0, 1, 0.35, 1).add(new THREE.SphereGeometry(0.26, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xf8d6e2, 0, 0.1, -0.12, -1.1, 0, 0, 1, 0.35, 1).ball(0.08, 0xffffff, 0, 0.12, 0.04, 1, 1, 1, 1).build() }] },
  drift: { label: 'Gather driftwood', icon: '🪵', tool: 'hatchet', hp: 2, drops: { driftwood: 2 }, respawn: 90_000, col: 0.45, fx: 'leaf', snd: 'chop', scale: [0.9, 1.2],
    parts: [{ geo: () => new Kit().add(new THREE.CylinderGeometry(0.13, 0.17, 1.6, 7), 0xcfc4b8, 0, 0.14, 0, 0, 0.4, Math.PI / 2).add(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 5), 0xbdb2a6, 0.3, 0.28, 0.2, 0.6, 0, 0.4).build() }] },
  clay: { label: 'Dig dew clay', icon: '🟤', hp: 2, drops: { clay: 2 }, respawn: 80_000, col: 0.4, fx: 'stone', snd: 'land', scale: [0.9, 1.2],
    parts: [{ geo: () => new Kit().ball(0.45, 0xc98f7e, 0, 0.05, 0, 1.3, 0.45, 1.1).ball(0.25, 0xd9a08c, 0.3, 0.18, 0.1, 1, 0.6, 1).ball(0.06, 0xeaf6ff, -0.15, 0.25, 0.2, 1, 0.5, 1, 0).build() }] },
  sandpile: { label: 'Scoop blush sand', icon: '🏜️', hp: 1, drops: { sand: 2 }, respawn: 50_000, col: 0, fx: 'stone', snd: 'step:sand', scale: [0.9, 1.3],
    parts: [{ geo: () => new Kit().add(new THREE.ConeGeometry(0.5, 0.35, 9), 0xf8dcd0, 0, 0.17, 0).ball(0.1, 0xffb3c6, 0.25, 0.08, 0.2, 1, 0.4, 1).build() }] },
};

/** where each biome's nodes grow: [kind, centre x, centre z, spread, count, min spacing] (centres relative to the biome) */
export const SPAWNS: Record<Exclude<BiomeId, 'prairie'>, [NodeKindId, number, number, number, number, number][]> = {
  sakura: [['sakura', -6, -6, 12, 9, 2.2], ['sakura', 6, 9, 12, 8, 2.2], ['sakura', 9, -1, 8, 4, 2.2], ['silkbush', -2, 12, 10, 5, 1.6], ['silkbush', -10, 2, 6, 3, 1.6],
    ['pquartz', 12, 8, 7, 3, 1.6], ['pquartz', -9, -10, 6, 2, 1.6], ['nectar', 2, -12, 12, 5, 1.4], ['nectar', 13, 2, 5, 2, 1.4]],
  azure: [['azure', 4, -6, 12, 10, 2.0], ['azure', 6, 9, 12, 8, 2.0], ['azure', -12, 4, 6, 4, 2.0], ['mushroom', -3, 8, 12, 6, 1.4], ['mushroom', 8, -2, 8, 3, 1.4],
    ['sapvine', 10, 4, 9, 4, 1.6], ['sapvine', -12, -12, 6, 2, 1.6], ['moonrock', -2, 13, 9, 3, 1.8], ['moonrock', 13, -9, 6, 2, 1.8]],
  cliffs: [['shardrock', -6, 4, 14, 5, 1.8], ['shardrock', 9, -6, 8, 3, 1.8], ['skyquartz', -9, -7, 8, 3, 1.6], ['skyquartz', 10, 8, 6, 2, 1.6],
    ['cotton', 2, 10, 14, 6, 1.4], ['cotton', -12, 0, 6, 3, 1.4]],
  lagoon: [['seaglass', 0, 0, 30, 9, 2.0], ['pearl', 0, 2, 22, 6, 2.2], ['drift', 0, -4, 34, 6, 2.5], ['clay', 0, 0, 30, 5, 2.2], ['sandpile', 0, -6, 30, 6, 2.0]],
};
/** giant co-op nodes (world coords) */
export const GIANTS: { id: string; kind: NodeKindId; biome: BiomeId; x: number; z: number }[] = [
  { id: 'gSakura', kind: 'giantSakura', biome: 'sakura', x: 47, z: 12 },
  { id: 'gGeode', kind: 'geode', biome: 'azure', x: -47, z: 7 },
  { id: 'gMeteor', kind: 'meteor', biome: 'cliffs', x: 12, z: -49 },
];
