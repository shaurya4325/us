// The archipelago: five soothing biomes joined by soft land bridges, plus the maths that shapes the terrain.
// Everything here is pure (no three.js) so the terrain, collisions, audio zones and tests all agree.
import type { ItemId } from './items';

export type BiomeId = 'prairie' | 'sakura' | 'azure' | 'cliffs' | 'lagoon';
export type Zone = BiomeId | 'home' | 'night';
export type Surface = 'grass' | 'wood' | 'stone' | 'sand' | 'water' | 'carpet';

export interface Biome {
  id: BiomeId; name: string; dir: string; cx: number; cz: number; r: number; music: Zone;
  sky: [string, string, string]; fog: number; fogNear: number; fogFar: number;
  grass: [number, number]; edge: number; tuft: [number, number, number]; surface: Surface; res: ItemId[];
}

export const BIOMES: Record<BiomeId, Biome> = {
  prairie: {
    id: 'prairie', name: 'Sunlit Prairie Homestead', dir: 'home', cx: 0, cz: 0, r: 23, music: 'prairie',
    sky: ['#9fd9f2', '#ffe3ef', '#fff6e8'], fog: 0xe9f4f0, fogNear: 36, fogFar: 92,
    grass: [0x7ec88b, 0x99df9e], edge: 0xd7c3a8, tuft: [0.33, 0.45, 0.5], surface: 'grass', res: ['wood', 'stone', 'crystal', 'flower', 'roseOre'],
  },
  sakura: {
    id: 'sakura', name: 'Sakura Wind-Blossom Grove', dir: 'east', cx: 55, cz: 3, r: 20, music: 'sakura',
    sky: ['#f7c8dc', '#ffe6f0', '#fff4f2'], fog: 0xfbe3ec, fogNear: 38, fogFar: 92,
    grass: [0x9fd49a, 0xf3c3d6], edge: 0xe2b9b4, tuft: [0.9, 0.5, 0.78], surface: 'grass', res: ['sakuraWood', 'silk', 'pinkQuartz', 'nectar'],
  },
  azure: {
    id: 'azure', name: 'Azure Whisper Woods', dir: 'west', cx: -55, cz: -3, r: 20, music: 'azure',
    sky: ['#6c7fd6', '#a9c6f2', '#dceefa'], fog: 0xb4c8ee, fogNear: 31, fogFar: 78,
    grass: [0x4f74c4, 0x63b4cc], edge: 0x6f6ca4, tuft: [0.58, 0.55, 0.55], surface: 'grass', res: ['azureWood', 'sap', 'moss', 'moonstone'],
  },
  cliffs: {
    id: 'cliffs', name: 'Cloud-Reach Starlight Cliffs', dir: 'north', cx: 3, cz: -55, r: 19, music: 'cliffs',
    sky: ['#b8a6e8', '#f6d9ec', '#fff1d6'], fog: 0xeadcf2, fogNear: 38, fogFar: 100,
    grass: [0xb39ce4, 0xebcf8c], edge: 0xa893cc, tuft: [0.76, 0.42, 0.7], surface: 'stone', res: ['shard', 'skyQuartz', 'cotton'],
  },
  lagoon: {
    id: 'lagoon', name: 'Crystal Dew Lagoon', dir: 'south', cx: -3, cz: 55, r: 21, music: 'lagoon',
    sky: ['#8fe3e8', '#e6f8f4', '#fff6ee'], fog: 0xe4f6f2, fogNear: 40, fogFar: 104,
    grass: [0xf2dcb0, 0xf6cfc6], edge: 0xe8d3b4, tuft: [0.14, 0.45, 0.72], surface: 'sand', res: ['clay', 'seaGlass', 'pearl', 'driftwood', 'sand'],
  },
};
export const BIOME_IDS = Object.keys(BIOMES) as BiomeId[];
export const OUTER: BiomeId[] = ['sakura', 'azure', 'cliffs', 'lagoon'];

/* ---------------- fixed landmarks (shared by terrain, scenes and the audio zones) ---------------- */
export const EDGE = 23;                                         // prairie walkable radius (superellipse)
export const POND = { x: -6, z: 5, r: 3.3 };
export const PLOT = { x: 5.5, z: -4.5 };
export const HILL = { x: -25, z: 25, r: 10, h: 1.2 };          // Cloud-Temple hill (prairie corner)
const SK = BIOMES.sakura, AZ = BIOMES.azure, CL = BIOMES.cliffs, LG = BIOMES.lagoon;
export const STREAM = { z: (x: number) => SK.cz + 5.5 * Math.sin((x - SK.cx) * 0.16 + 0.5), x0: SK.cx - 13, x1: SK.cx + 17 };
export const SHRINE = { x: SK.cx + 7, z: SK.cz - 10, r: 4.6 };
export const KNOLL = { x: AZ.cx - 7, z: AZ.cz - 6, h: 2.8 };
export const SKY = { x: CL.cx + 2, z: CL.cz - 31, r: 6.2, h: 5.4 };   // hidden sky island (Wind-Bell Sanctuary)
export const LAGOON = { x: LG.cx, z: LG.cz + 2, r: 11.5 };
export const WATER = { pond: -0.1, stream: -0.12, lagoon: -0.35 };
const BRIDGES: { b: BiomeId; ax: number; az: number; bx: number; bz: number; w: number }[] = [
  { b: 'sakura', ax: 20, az: 1, bx: 38, bz: 3, w: 3.7 },
  { b: 'azure', ax: -20, az: -1, bx: -38, bz: -3, w: 3.7 },
  { b: 'cliffs', ax: 1, az: -20, bx: 3, bz: -39, w: 3.9 },
  { b: 'lagoon', ax: -1, az: 20, bx: -3, bz: 37, w: 3.9 },
];

/* ---------------- small maths ---------------- */
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const sstep = (v: number, a: number, b: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smax = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + (h * h * k) / 4; };
export const superR = (x: number, z: number) => Math.pow(x ** 4 + z ** 4, 0.25);
const noise = (x: number, z: number) => 0.28 * Math.sin(x * 0.33 + 0.4) * Math.cos(z * 0.29) + 0.22 * Math.sin((x + z) * 0.19 + 1.3) + 0.12 * Math.cos(x * 0.71 - z * 0.53);
const lobe = (x: number, z: number, b: Biome, seed: number) => {
  const dx = x - b.cx, dz = z - b.cz, a = Math.atan2(dz, dx);
  return b.r - Math.hypot(dx, dz) * (1 + 0.065 * Math.sin(3 * a + seed) + 0.04 * Math.sin(5 * a + seed * 2.3));
};
const segT = (x: number, z: number, B: (typeof BRIDGES)[number]) => {
  const vx = B.bx - B.ax, vz = B.bz - B.az, t = clamp(((x - B.ax) * vx + (z - B.az) * vz) / (vx * vx + vz * vz), 0, 1);
  return [t, Math.hypot(x - (B.ax + vx * t), z - (B.az + vz * t))] as const;
};

/** signed "how far inside the land" (>0 inside) and each biome's blend weight at (x,z) */
export function landInfo(x: number, z: number) {
  const lp = smax(EDGE - superR(x, z), HILL.r - Math.hypot(x - HILL.x, z - HILL.z), 4);
  const w: Record<BiomeId, number> = { prairie: sstep(lp, -6, 3), sakura: 0, azure: 0, cliffs: 0, lagoon: 0 };
  let L = lp;
  OUTER.forEach((id, i) => { const l = lobe(x, z, BIOMES[id], i * 1.7 + 0.4); L = smax(L, l, 4); w[id] += sstep(l, -6, 3); });
  const ls = SKY.r - Math.hypot(x - SKY.x, z - SKY.z); L = Math.max(L, ls); w.cliffs += sstep(ls, -4, 2);
  for (const B of BRIDGES) {
    const [t, d] = segT(x, z, B), l = B.w - d;
    if (l < -7) continue;
    L = smax(L, l, 3);
    const m = sstep(l, -5, 2), k = sstep(t, 0.15, 0.85);
    w.prairie += m * (1 - k); w[B.b] += m * k;
  }
  return { L, w };
}

const prairieH = (x: number, z: number) => {
  let h = noise(x, z) * 0.9 + 0.25;
  const pd = Math.hypot(x - POND.x, z - POND.z);
  if (pd < POND.r + 1.6) h = lerp(-0.55, h, sstep(pd, POND.r - 0.6, POND.r + 1.6));
  const pl = Math.hypot(x - PLOT.x, z - PLOT.z);
  if (pl < 9) h = lerp(0.3, h, sstep(pl, 5, 9));                        // flatten the house plot
  h += HILL.h * (1 - sstep(Math.hypot(x - HILL.x, z - HILL.z), 4, 9));  // Cloud-Temple hill
  return h;
};
const streamD = (x: number, z: number) => (x < STREAM.x0 - 2 || x > STREAM.x1 + 2 ? 99 : Math.abs(z - STREAM.z(x)) + (x < STREAM.x0 ? (STREAM.x0 - x) * 2 : x > STREAM.x1 ? (x - STREAM.x1) * 2 : 0));
const sakuraH = (x: number, z: number) => {
  let h = noise(x, z) * 0.75 + 0.32;
  const sd = streamD(x, z);
  if (sd < 2.6) h = lerp(-0.48, h, sstep(sd, 1.1, 2.6));
  const pd = Math.hypot(x - SHRINE.x, z - SHRINE.z);
  if (pd < SHRINE.r + 1.6) h = lerp(-0.55, h, sstep(pd, SHRINE.r - 0.6, SHRINE.r + 1.6));
  return h;
};
const azureH = (x: number, z: number) => noise(x, z) * 1.25 + 0.38 + KNOLL.h * (1 - sstep(Math.hypot(x - KNOLL.x, z - KNOLL.z), 2.6, 9.5));
const cliffsH = (x: number, z: number) => {
  const sk = Math.hypot(x - SKY.x, z - SKY.z);
  return sk < SKY.r + 4 ? SKY.h + noise(x, z) * 0.2 : 4.6 + noise(x * 1.3, z * 1.3) * 0.45;
};
const SPITS = [0.5, 2.3, 4.1].map((a) => [LAGOON.x + Math.cos(a) * 8.8, LAGOON.z + Math.sin(a) * 8.8]);
export const TIDE_POOLS = [[-14, 67], [8.5, 66.5], [-15.5, 49.5], [10, 50]] as const;
const lagoonH = (x: number, z: number) => {
  const d = Math.hypot(x - LAGOON.x, z - LAGOON.z);
  let h = 0.45 + noise(x, z) * 0.15 - 1.95 * (1 - sstep(d, 6.5, LAGOON.r));
  h += 1.95 * (1 - sstep(d, 1.9, 3.7));                                // the islet in the middle (pearl grotto)
  for (const [sx, sz] of SPITS) h += 1.25 * Math.exp(-((x - sx) ** 2 + (z - sz) ** 2) / 5.5);
  for (const [tx, tz] of TIDE_POOLS) { const td = Math.hypot(x - tx, z - tz); if (td < 1.8) h = lerp(-0.62, h, sstep(td, 0.7, 1.8)); }
  return h;
};
const H: Record<BiomeId, (x: number, z: number) => number> = { prairie: prairieH, sakura: sakuraH, azure: azureH, cliffs: cliffsH, lagoon: lagoonH };

/** terrain height + land depth + biome weights in one pass (the terrain mesher uses this) */
export function sampleTerrain(x: number, z: number) {
  const { L, w } = landInfo(x, z);
  let sum = 0, h = 0;
  for (const id of BIOME_IDS) if (w[id] > 0.001) { sum += w[id]; h += w[id] * H[id](x, z); }
  h = sum > 0.001 ? h / sum : -6;
  if (L < 0) h -= ((-L) / 3.2) ** 2 * 3.2;
  return { h, L, w, sum };
}
/** terrain height at (x,z), including the soft drop into the cloud sea past the shore */
export function heightAt(x: number, z: number) {
  const { L, w } = landInfo(x, z);
  let sum = 0, h = 0;
  for (const id of BIOME_IDS) if (w[id] > 0.001) { sum += w[id]; h += w[id] * H[id](x, z); }
  h = sum > 0.001 ? h / sum : -6;
  if (L < 0) h -= ((-L) / 3.2) ** 2 * 3.2;
  return h;
}
/** dominant biome at (x,z) (with its weight) */
export function biomeAt(x: number, z: number): [BiomeId, number] {
  const { w } = landInfo(x, z);
  let best: BiomeId = 'prairie', bw = -1, sum = 0;
  for (const id of BIOME_IDS) { sum += w[id]; if (w[id] > bw) { bw = w[id]; best = id; } }
  return [best, sum > 0 ? bw / sum : 1];
}
/** the water surface height over (x,z), or null if there is no water there */
export function waterAt(x: number, z: number): number | null {
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.3) return WATER.pond;
  if (Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.r + 0.3 || streamD(x, z) < 2.2) return WATER.stream;
  if (Math.hypot(x - LAGOON.x, z - LAGOON.z) < LAGOON.r + 0.5) return WATER.lagoon;
  for (const [tx, tz] of TIDE_POOLS) if (Math.hypot(x - tx, z - tz) < 1.5) return -0.18;
  return null;
}

/* ---------------- walkable platforms (bridges, walkways, decks): rectangles along an axis, or discs ---------------- */
export interface Platform {
  id: string; x: number; z: number; ang?: number; hw?: number; hl?: number; r?: number;
  h0: number; h1?: number; arc?: number; surface: Surface;
}
/** surface height of a platform at (x,z), or null if (x,z) is not on it */
export function platformH(p: Platform, x: number, z: number): number | null {
  if (p.r !== undefined) return Math.hypot(x - p.x, z - p.z) <= p.r ? p.h0 : null;
  const a = p.ang ?? 0, dx = x - p.x, dz = z - p.z, u = dx * Math.cos(a) + dz * Math.sin(a), v = -dx * Math.sin(a) + dz * Math.cos(a);
  if (Math.abs(u) > (p.hw ?? 1) || Math.abs(v) > (p.hl ?? 1)) return null;
  const t = (v / (p.hl ?? 1) + 1) / 2;
  return lerp(p.h0, p.h1 ?? p.h0, t) + (p.arc ? Math.sin(t * Math.PI) * p.arc : 0);
}
/** the two lantern footbridges over the koi stream (they run across the stream, along z) */
export const FOOTBRIDGES: Platform[] = [SK.cx - 4, SK.cx + 9].map((x, i) => ({ id: 'foot' + i, x, z: STREAM.z(x), ang: 0, hw: 0.75, hl: 2.7, h0: 0.32, h1: 0.32, arc: 0.32, surface: 'wood' as Surface }));
