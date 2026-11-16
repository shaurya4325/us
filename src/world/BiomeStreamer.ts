// Zone streaming for the overworld: the terrain is split into chunks and each biome's dressing (grass, flowers,
// clouds, water, GPU petals/fireflies/motes) lives in its own group. Only the biome you stand in and its immediate
// neighbours are drawn; everything else is hidden (and frustum culled), which keeps draw calls well under 80.
import * as THREE from 'three';
import {
  BIOMES, BIOME_IDS, FOOTBRIDGES, KNOLL, LAGOON, POND, PLOT, SHRINE, SKY, STREAM, TIDE_POOLS, WATER,
  biomeAt, heightAt, landInfo, sampleTerrain, waterAt, type BiomeId,
} from '../data/biomes';
import { Kit, basic, driftField, mat, petalTex, rand, seeThrough, softDot, waterMaterial, windy } from './gfx';

const X0 = -84, Z0 = -98, CH = 28, NX = 6, NZ = 7, SEG = 35;
type ChunkData = { pos: Float32Array; nor: Float32Array; col: Float32Array; idx: Uint32Array };
const CHUNKS = new Map<string, ChunkData | null>();           // CPU-side cache: rebuilding after the house is instant
const SCATTER = new Map<string, Float32Array>();

const C = new THREE.Color(), C2 = new THREE.Color();
function terrainColor(x: number, z: number, h: number, L: number, w: Record<BiomeId, number>, sum: number, out: THREE.Color) {
  out.setRGB(0, 0, 0);
  const n = 0.5 + 0.5 * Math.sin(x * 0.4 + z * 0.3) * Math.cos(z * 0.2) + (Math.sin(x * 2.1 + z * 1.7) * 0.5) * 0.15;
  for (const id of BIOME_IDS) {
    if (w[id] < 0.001) continue;
    const B = BIOMES[id];
    C.set(B.grass[0]).lerp(C2.set(B.grass[1]), THREE.MathUtils.clamp(n, 0, 1));
    out.r += C.r * w[id]; out.g += C.g * w[id]; out.b += C.b * w[id];
  }
  if (sum > 0.001) out.multiplyScalar(1 / sum); else out.set(0xd7c3a8);
  const wl = waterAt(x, z);
  if (wl !== null && h < wl + 0.35) out.lerp(C.set(w.lagoon > 0.5 ? 0xbfe9dc : 0xf3e3b5), THREE.MathUtils.smoothstep(wl + 0.35 - h, 0, 0.45));
  if (w.sakura > 0.5 && Math.sin(x * 0.9) * Math.cos(z * 0.8) > 0.55) out.lerp(C.set(0xffd1e3), 0.45);   // fallen-petal patches
  if (L < 0) out.lerp(C.set(BIOMES[biomeAt(x, z)[0]].edge), Math.min(1, -L / 2.2));
  return out;
}

function buildChunk(ix: number, iz: number): ChunkData | null {
  const key = `${ix},${iz}`;
  if (CHUNKS.has(key)) return CHUNKS.get(key)!;
  const x0 = X0 + ix * CH, z0 = Z0 + iz * CH, step = CH / SEG, G = SEG + 3;
  // skip chunks that are pure sky
  let any = false;
  for (let i = 0; i <= 6 && !any; i++) for (let j = 0; j <= 6 && !any; j++) if (landInfo(x0 + (i / 6) * CH, z0 + (j / 6) * CH).L > -9) any = true;
  if (!any) { CHUNKS.set(key, null); return null; }
  const hs = new Float32Array(G * G);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) hs[j * G + i] = heightAt(x0 + (i - 1) * step, z0 + (j - 1) * step);
  const V = (SEG + 1) ** 2, pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), col = new Float32Array(V * 3), c = new THREE.Color(), nv = new THREE.Vector3();
  for (let j = 0; j <= SEG; j++) for (let i = 0; i <= SEG; i++) {
    const v = j * (SEG + 1) + i, x = x0 + i * step, z = z0 + j * step, gi = (j + 1) * G + (i + 1), h = hs[gi];
    pos[v * 3] = x; pos[v * 3 + 1] = h; pos[v * 3 + 2] = z;
    nv.set(hs[gi - 1] - hs[gi + 1], 2 * step, hs[gi - G] - hs[gi + G]).normalize();      // shared normals: no seams between chunks
    nor[v * 3] = nv.x; nor[v * 3 + 1] = nv.y; nor[v * 3 + 2] = nv.z;
    const s = sampleTerrain(x, z);
    terrainColor(x, z, h, s.L, s.w, s.sum, c);
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  }
  const idx = new Uint32Array(SEG * SEG * 6);
  let k = 0;
  for (let j = 0; j < SEG; j++) for (let i = 0; i < SEG; i++) {
    const a = j * (SEG + 1) + i, b = a + 1, d = a + SEG + 1, e = d + 1;
    idx[k++] = a; idx[k++] = d; idx[k++] = b; idx[k++] = b; idx[k++] = d; idx[k++] = e;
  }
  const data = { pos, nor, col, idx };
  CHUNKS.set(key, data);
  return data;
}

/** random points inside one biome (dry land, away from the given exclusions), cached by key */
function scatter(key: string, biome: BiomeId, n: number, seed: number, ok: (x: number, z: number, h: number) => boolean = () => true, minW = 0.65) {
  if (SCATTER.has(key)) return SCATTER.get(key)!;
  const B = BIOMES[biome], r = rand(seed), out: number[] = [];
  const R = biome === 'prairie' ? 30 : B.r + 2;
  for (let tries = 0; out.length < n * 3 && tries < n * 6; tries++) {
    const x = B.cx + (r() - 0.5) * 2 * R, z = B.cz + (r() - 0.5) * 2 * R;
    const { L, w } = landInfo(x, z);
    if (L < 0.8) continue;
    let sum = 0; for (const id of BIOME_IDS) sum += w[id];
    if (w[biome] / sum < minW) continue;
    const h = heightAt(x, z), wl = waterAt(x, z);
    if (wl !== null && h < wl + 0.08) continue;
    if (!ok(x, z, h)) continue;
    out.push(x, h, z);
  }
  const a = new Float32Array(out); SCATTER.set(key, a); return a;
}

interface Bob { mesh: THREE.InstancedMesh; base: { x: number; y: number; z: number; s: number; p: number }[] }

export class BiomeStreamer {
  groups = {} as Record<BiomeId, THREE.Group>;
  private chunks: THREE.Mesh[] = [];
  private clouds: Bob[] = [];
  private koi: { mesh: THREE.InstancedMesh; path: (t: number, i: number) => [number, number, number, number] }[] = [];
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private v = new THREE.Vector3(); private s3 = new THREE.Vector3(); private e = new THREE.Euler();

  constructor(private scene: THREE.Scene, private uTime: { value: number }) {
    const ground = mat();
    for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
      const d = buildChunk(ix, iz); if (!d) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(d.nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(d.col, 3));
      g.setIndex(new THREE.BufferAttribute(d.idx, 1)); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, ground); m.userData.c = [X0 + (ix + 0.5) * CH, Z0 + (iz + 0.5) * CH];
      this.chunks.push(m); scene.add(m);
    }
    for (const id of BIOME_IDS) { const g = new THREE.Group(); g.name = id; this.groups[id] = g; scene.add(g); }
    this.dressPrairie(); this.dressSakura(); this.dressAzure(); this.dressCliffs(); this.dressLagoon();
    for (const id of BIOME_IDS) this.buildClouds(id);
    this.update(0, 0, 0);
    for (const id of BIOME_IDS) BiomeStreamer.bound(this.groups[id], id);
  }
  /** particles/clouds/fish skip three's default culling (their positions move), so give them the biome's sphere */
  static bound(g: THREE.Object3D, id: BiomeId) {
    const B = BIOMES[id], sph = new THREE.Sphere(new THREE.Vector3(B.cx, id === 'cliffs' ? 4 : 1, B.cz + (id === 'cliffs' ? -10 : 0)), (id === 'prairie' ? 31 : B.r + 5) + (id === 'cliffs' ? 12 : 0));
    g.traverse((o: any) => {
      if (o.frustumCulled !== false) return;
      if (o.isInstancedMesh) o.boundingSphere = sph.clone(); else if (o.geometry) o.geometry.boundingSphere = sph.clone();
      o.frustumCulled = true;
    });
  }

  /* ---------- shared dressing helpers ---------- */
  private grass(id: BiomeId, n: number, seed: number, ok?: (x: number, z: number, h: number) => boolean) {
    const tuft = new Kit();
    for (let k = 0; k < 3; k++) tuft.add(new THREE.ConeGeometry(0.045, 0.34, 3), 0xffffff, Math.cos(k * 2.1) * 0.05, 0.17, Math.sin(k * 2.1) * 0.05, 0.15 * Math.cos(k * 2.1), 0, 0.15 * Math.sin(k * 2.1));
    const pts = scatter(`grass:${id}`, id, n, seed, ok), cnt = pts.length / 3, [hh, ss, ll] = BIOMES[id].tuft;
    const mesh = new THREE.InstancedMesh(tuft.build(), windy(mat(), this.uTime, 0.35), Math.max(1, cnt)), r = rand(seed + 1), c = new THREE.Color();
    for (let i = 0; i < cnt; i++) {
      const s = 0.7 + r() * 0.8;
      this.m4.compose(this.v.set(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]), this.q.setFromEuler(this.e.set(0, r() * 6, 0)), this.s3.set(s, s, s));
      mesh.setMatrixAt(i, this.m4); mesh.setColorAt(i, c.setHSL(hh + (r() - 0.5) * 0.06, ss, ll + r() * 0.14));
    }
    mesh.count = cnt; this.groups[id].add(mesh);
  }
  private flowers(id: BiomeId, n: number, seed: number, cols: number[], ok?: (x: number, z: number, h: number) => boolean, glow = 0.22) {
    const fl = new Kit().cyl(0.012, 0.012, 0.22, 0x5aa86a).ball(0.06, 0xffffff, 0, 0.24, 0, 1, 0.7, 1, 0).build();
    const pts = scatter(`flower:${id}`, id, n, seed, ok), cnt = pts.length / 3;
    const mesh = new THREE.InstancedMesh(fl, windy(mat(), this.uTime, 0.25), Math.max(1, cnt)), r = rand(seed + 2), c = new THREE.Color();
    const gp: number[] = [], gc: number[] = [];
    for (let i = 0; i < cnt; i++) {
      const s = 0.8 + r() * 0.7, x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2], fc = cols[Math.floor(r() * cols.length)];
      this.m4.compose(this.v.set(x, y, z), this.q.identity(), this.s3.set(s, s, s));
      mesh.setMatrixAt(i, this.m4); mesh.setColorAt(i, c.set(fc));
      if (r() < glow) { gp.push(x, y + 0.3 * s, z); c.set(fc); gc.push(c.r, c.g, c.b); }
    }
    mesh.count = cnt; this.groups[id].add(mesh);
    if (gp.length) {
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
      this.groups[id].add(new THREE.Points(gg, new THREE.PointsMaterial({ size: 0.5, map: softDot(), vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
    }
  }
  private water(id: BiomeId, geo: THREE.BufferGeometry, y: number, x: number, z: number, deep?: string, light?: string, strip = false, alpha = 0.9) {
    const w = new THREE.Mesh(geo, waterMaterial(this.uTime, deep, light, strip, alpha));
    if (!strip) w.rotation.x = -Math.PI / 2;
    w.position.set(x, y, z); w.renderOrder = 2; this.groups[id].add(w);
    return w;
  }
  private statics(id: BiomeId, k: Kit, g?: Kit) {
    if (k.parts.length) this.groups[id].add(new THREE.Mesh(k.build(), seeThrough(mat())));
    if (g?.parts.length) this.groups[id].add(new THREE.Mesh(g.build(), basic(0xffffff, { vertexColors: true })));
  }
  private koiIn(id: BiomeId, n: number, path: (t: number, i: number) => [number, number, number, number]) {
    const k = new Kit().ball(0.12, 0xff8a3d, 0, 0, 0, 0.7, 0.45, 1.6).add(new THREE.ConeGeometry(0.08, 0.14, 4), 0xffffff, 0, 0, -0.22, Math.PI / 2);
    const mesh = new THREE.InstancedMesh(k.build(), mat(), n), c = new THREE.Color();
    for (let i = 0; i < n; i++) mesh.setColorAt(i, c.set([0xffffff, 0xffd2b0, 0xff9a6a][i % 3]));
    mesh.frustumCulled = false; this.groups[id].add(mesh); this.koi.push({ mesh, path });
  }

  /* ---------- the five biomes ---------- */
  private dressPrairie() {
    const clear = (x: number, z: number) => Math.hypot(x - POND.x, z - POND.z) > POND.r + 0.5;
    this.grass('prairie', 3300, 7, clear);
    this.flowers('prairie', 950, 9, [0xfff07a, 0xff9ec4, 0xffffff, 0xffc94a, 0xff6fa8], (x, z) => clear(x, z) && Math.hypot(x - PLOT.x, z - PLOT.z) > 5);
    this.groups.prairie.add(driftField(70, this.uTime, { x: 0, z: 0, r: 24, y0: 0.4, y1: 3.2, colors: [0xffffff, 0xfff6d8], size: 0.16, speed: 0.6, mode: 1 }));   // dandelion fluff
    // soft sun shafts (Sky-like), additive and static
    const k = new Kit();
    for (let i = 0; i < 4; i++) k.add(new THREE.PlaneGeometry(3, 16), 0xfff3d6, -10 + i * 7, 6, -8 + i * 2, 0, Math.PI / 4, 0.5);
    const rays = new THREE.Mesh(k.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.groups.prairie.add(rays);
  }

  private dressSakura() {
    const B = BIOMES.sakura, r = rand(51);
    const dry = (x: number, z: number) => Math.abs(z - STREAM.z(x)) > 2.6 && Math.hypot(x - SHRINE.x, z - SHRINE.z) > SHRINE.r + 1;
    this.grass('sakura', 1900, 13, dry);
    this.flowers('sakura', 650, 17, [0xffc8dc, 0xffffff, 0xff9ec4, 0xffe0ec], dry, 0.3);
    this.groups.sakura.add(driftField(460, this.uTime, { x: B.cx, z: B.cz, r: B.r + 3, y0: 0, y1: 7.5, colors: [0xffc0d6, 0xffd8e6, 0xffa8c8, 0xfff0f5], size: 0.32, speed: 1, wind: 0.55, mode: 0, tex: petalTex(), spin: true }));
    // the koi stream (a ribbon of water following the stream curve)
    const pts: number[] = [], uvs: number[] = [], idx: number[] = [], N = 60;
    for (let i = 0; i <= N; i++) {
      const x = STREAM.x0 - 1 + ((STREAM.x1 - STREAM.x0 + 2) * i) / N, z = STREAM.z(x), dz = STREAM.z(x + 0.1) - z, l = Math.hypot(0.1, dz), nx = -dz / l, nz = 0.1 / l;
      const half = 2.15 - Math.max(0, (STREAM.x0 + 1 - x) * 0.6, (x - STREAM.x1 + 1) * 0.6);
      pts.push(x + nx * half, 0, z + nz * half, x - nx * half, 0, z - nz * half); uvs.push(i / N, 0, i / N, 1);
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); sg.setIndex(idx);
    this.water('sakura', sg, WATER.stream, 0, 0, '#3cc0c8', '#b8f4ee', true, 0.82);
    this.water('sakura', new THREE.CircleGeometry(SHRINE.r + 0.3, 40), WATER.stream, SHRINE.x, SHRINE.z, '#2fb0c4', '#a8efe8');
    this.koiIn('sakura', 7, (t, i) => {
      if (i < 4) { const a = t * (0.28 + i * 0.05) + i * 1.6, rr = 1.6 + i * 0.6; return [SHRINE.x + Math.cos(a) * rr, -0.26, SHRINE.z + Math.sin(a) * rr, -a]; }
      const u = ((t * 0.03 + i * 0.31) % 1), x = STREAM.x0 + (STREAM.x1 - STREAM.x0) * u, z = STREAM.z(x) + Math.sin(t + i) * 0.4;
      return [x, -0.28, z, Math.atan2(0.2, STREAM.z(x + 0.2) - STREAM.z(x))];
    });
    // static dressing: rosy moss boulders, stone lanterns (toro), stream rim stones, the two lantern footbridges
    const k = new Kit(), g = new Kit();
    for (let i = 0; i < 14; i++) {
      const x = B.cx + (r() - 0.5) * 34, z = B.cz + (r() - 0.5) * 34;
      if (!dry(x, z) || landInfo(x, z).L < 2 || biomeAt(x, z)[0] !== 'sakura') continue;
      const y = heightAt(x, z), s = 0.4 + r() * 0.5;
      k.add(new THREE.DodecahedronGeometry(s, 1), 0xd9b8c4, x, y + s * 0.4, z, r(), r(), 0, 1.3, 0.75, 1).add(new THREE.SphereGeometry(s * 0.9, 8, 4, 0, 6.29, 0, 1.1), 0x8fc98a, x, y + s * 0.62, z, 0, 0, 0, 1.4, 0.6, 1.1);
    }
    for (let x = STREAM.x0 + 1; x < STREAM.x1; x += 1.7) for (const side of [-1, 1]) {
      const z = STREAM.z(x) + side * (2.25 + r() * 0.3);
      if (r() < 0.55) k.add(new THREE.DodecahedronGeometry(0.16 + r() * 0.1, 0), 0xe7e0ee, x, heightAt(x, z) + 0.03, z, r(), r(), 0, 1, 0.6, 1);
    }
    const toro = (x: number, z: number) => {
      const y = heightAt(x, z);
      k.box(0.5, 0.12, 0.5, 0xcfc6d6, x, y, z).cyl(0.09, 0.12, 0.7, 0xcfc6d6, x, y + 0.12, z).box(0.42, 0.34, 0.42, 0xcfc6d6, x, y + 0.82, z)
        .add(new THREE.ConeGeometry(0.42, 0.3, 4), 0xbfb6c8, x, y + 1.3, z, 0, Math.PI / 4).ball(0.07, 0xcfc6d6, x, y + 1.5, z);
      g.box(0.3, 0.22, 0.44, 0xffd9a0, x, y + 0.88, z);
    };
    [[B.cx - 9, B.cz + 8], [B.cx + 3, B.cz - 4], [B.cx + 12, B.cz + 12], [B.cx - 12, B.cz - 4], [SHRINE.x - 3, SHRINE.z + 6.2], [SHRINE.x + 3, SHRINE.z + 6.2]].forEach(([x, z]) => toro(x, z));
    for (const fb of FOOTBRIDGES) {
      const N2 = 9;
      for (let i = 0; i < N2; i++) {
        const t = (i + 0.5) / N2, z = fb.z - fb.hl! + t * fb.hl! * 2, y = fb.h0 + Math.sin(t * Math.PI) * fb.arc! - 0.08;
        k.box(fb.hw! * 2 + 0.1, 0.08, (fb.hl! * 2) / N2 - 0.04, 0xc98f6a, fb.x, y, z);
      }
      for (const sx of [-1, 1]) {
        for (let i = 0; i <= 4; i++) { const t = i / 4, z = fb.z - fb.hl! + t * fb.hl! * 2, y = fb.h0 + Math.sin(t * Math.PI) * fb.arc!; k.cyl(0.035, 0.035, 0.55, 0xb06a4a, fb.x + sx * (fb.hw! + 0.02), y, z); }
        k.add(new THREE.TorusGeometry(fb.hl!, 0.035, 4, 16, Math.PI), 0xd9485f, fb.x + sx * (fb.hw! + 0.02), fb.h0 + 0.5, fb.z, 0, Math.PI / 2, 0, 1, 0.42, 1);
        g.ball(0.1, 0xffc27a, fb.x + sx * (fb.hw! + 0.02), fb.h0 + 0.62, fb.z - fb.hl!, 1, 1.3, 1, 0).ball(0.1, 0xffc27a, fb.x + sx * (fb.hw! + 0.02), fb.h0 + 0.62, fb.z + fb.hl!, 1, 1.3, 1, 0);
      }
    }
    this.statics('sakura', k, g);
  }

  private dressAzure() {
    const B = BIOMES.azure, r = rand(61);
    this.grass('azure', 1900, 23);
    this.flowers('azure', 300, 29, [0x9ad8ff, 0xb6a6ff, 0x7fe8ff, 0xffffff], undefined, 0.6);
    // glowing mushroom clusters (decor) + fireflies + low blue mist
    const ms = new Kit().cyl(0.025, 0.035, 0.16, 0xe8f0ff).ball(0.09, 0xffffff, 0, 0.17, 0, 1, 0.55, 1).build();
    const mp = scatter('mush:azure', 'azure', 320, 31), mc = mp.length / 3;
    const mm = new THREE.InstancedMesh(ms, basic(0xffffff), Math.max(1, mc)), c = new THREE.Color();
    for (let i = 0; i < mc; i++) {
      const s = 0.6 + r() * 1.1;
      this.m4.compose(this.v.set(mp[i * 3], mp[i * 3 + 1], mp[i * 3 + 2]), this.q.identity(), this.s3.setScalar(s));
      mm.setMatrixAt(i, this.m4); mm.setColorAt(i, c.set([0x6ff0ff, 0x9ad8ff, 0xb6a6ff, 0x7fffd4][i % 4]));
    }
    mm.count = mc; this.groups.azure.add(mm);
    this.groups.azure.add(driftField(260, this.uTime, { x: B.cx, z: B.cz, r: B.r + 1, y0: 0.4, y1: 3.6, colors: [0xbfffff, 0xfff0a0, 0x9ad8ff], size: 0.2, speed: 0.7, mode: 2, additive: true }));
    this.groups.azure.add(driftField(34, this.uTime, { x: B.cx, z: B.cz, r: B.r, y0: 0.2, y1: 1.0, colors: [0xdfefff, 0xcfe0ff], size: 6, speed: 0.15, mode: 1, opacity: 0.28 }));
    // ancient stone stairways up the knoll + mossy standing stones
    const k = new Kit(), g = new Kit();
    for (const a of [0.4, 2.5, 4.3]) {
      for (let s = 0; s < 9; s++) {
        const d = 9.2 - s * 0.85, x = KNOLL.x + Math.cos(a) * d, z = KNOLL.z + Math.sin(a) * d, y = heightAt(x, z);
        k.add(new THREE.BoxGeometry(1.5, 0.16, 0.7), 0x9aa0c4, x, y + 0.02, z, 0, -a + Math.PI / 2, 0);
      }
    }
    for (let i = 0; i < 10; i++) {
      const a = r() * 6.28, d = 6 + r() * 12, x = B.cx + Math.cos(a) * d, z = B.cz + Math.sin(a) * d;
      if (landInfo(x, z).L < 2 || biomeAt(x, z)[0] !== 'azure') continue;
      const y = heightAt(x, z), h = 0.8 + r() * 1.2;
      k.add(new THREE.BoxGeometry(0.5, h, 0.4), 0x7d84b0, x, y + h / 2 - 0.1, z, 0, r() * 3, (r() - 0.5) * 0.2).add(new THREE.SphereGeometry(0.3, 6, 3, 0, 6.29, 0, 1.2), 0x3f9a8a, x, y + h - 0.12, z, 0, 0, 0, 1, 0.5, 0.9);
      g.ball(0.05, 0x7fe8ff, x + 0.26, y + h * 0.6, z, 1, 1, 1, 0);
    }
    this.statics('azure', k, g);
  }

  private dressCliffs() {
    const B = BIOMES.cliffs, r = rand(71);
    this.grass('cliffs', 1500, 37);
    this.flowers('cliffs', 520, 41, [0xd9c6ff, 0xfff0a0, 0xffffff, 0xf3c6ff], undefined, 0.3);
    this.groups.cliffs.add(driftField(220, this.uTime, { x: B.cx, z: B.cz - 6, r: B.r + 8, y0: 5, y1: 10, colors: [0xfff0a0, 0xe6dcff, 0xffffff], size: 0.22, speed: 0.5, mode: 2, additive: true }));
    const k = new Kit(), g = new Kit();
    // rainbow mist bridges: soft arcs of six colours over the clifftops
    const bows = new Kit();
    for (const [x, z, a, R] of [[B.cx - 8, B.cz + 2, 0.7, 6], [B.cx + 9, B.cz - 9, 2.2, 5]]) {
      [0xff9ec4, 0xffc27a, 0xfff07a, 0x9fe0a0, 0x9ad8ff, 0xc9a6ff].forEach((col, i) => bows.add(new THREE.TorusGeometry(R - i * 0.18, 0.09, 4, 28, Math.PI), col, x, heightAt(x, z) - 0.3, z, 0, a, 0));
    }
    this.groups.cliffs.add(new THREE.Mesh(bows.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false })));
    // singing wind-chimes on little posts, weathered stone pillars
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 6.28 + 0.4, d = 9 + r() * 6, x = B.cx + Math.cos(a) * d, z = B.cz + Math.sin(a) * d;
      if (landInfo(x, z).L < 2.5) continue;
      const y = heightAt(x, z);
      k.cyl(0.05, 0.06, 1.9, 0xb98a63, x, y, z).box(0.7, 0.06, 0.06, 0xb98a63, x, y + 1.85, z);
      for (let j = 0; j < 4; j++) g.cyl(0.03, 0.03, 0.45 - j * 0.07, [0xfff0a0, 0xe6dcff, 0xffffff, 0xffd1e3][j], x - 0.27 + j * 0.18, y + 1.35 + j * 0.035, z);
    }
    for (let i = 0; i < 9; i++) {
      const x = B.cx + (r() - 0.5) * 30, z = B.cz + (r() - 0.5) * 30;
      if (landInfo(x, z).L < 2 || biomeAt(x, z)[0] !== 'cliffs') continue;
      const y = heightAt(x, z), h = 0.6 + r() * 1.8;
      k.cyl(0.32, 0.38, h, 0xd8cfe8, x, y - 0.1, z, 8).cyl(0.4, 0.4, 0.14, 0xe6dff0, x, y + h - 0.1, z, 8);
    }
    this.statics('cliffs', k, g);
  }

  private dressLagoon() {
    const B = BIOMES.lagoon, r = rand(81);
    const beach = (x: number, z: number, h: number) => h > 0.15;
    this.grass('lagoon', 600, 43, (x, z, h) => h > 0.3 && Math.hypot(x - LAGOON.x, z - LAGOON.z) > LAGOON.r + 2.5);
    this.flowers('lagoon', 280, 47, [0xffb3c6, 0xffffff, 0xffd6e0], (x, z, h) => h > 0.25 && Math.hypot(x - LAGOON.x, z - LAGOON.z) > LAGOON.r + 2, 0.15);
    this.water('lagoon', new THREE.CircleGeometry(LAGOON.r + 0.7, 56), WATER.lagoon, LAGOON.x, LAGOON.z, '#16b3c2', '#a6f5ec', false, 0.86);
    for (const [x, z] of TIDE_POOLS) this.water('lagoon', new THREE.CircleGeometry(1.5, 18), -0.18, x, z, '#43c6cf', '#c8faf2');
    this.groups.lagoon.add(driftField(150, this.uTime, { x: LAGOON.x, z: LAGOON.z, r: LAGOON.r, y0: -0.25, y1: 0.35, colors: [0xffffff, 0xd8fff8], size: 0.2, speed: 0.4, mode: 2, additive: true }));
    // shells & starfish (instanced decor), sea-stones, palms, a beach umbrella with two towels
    const sh = new Kit().add(new THREE.ConeGeometry(0.07, 0.1, 6), 0xffffff, 0, 0.04, 0, Math.PI / 2.4).build();
    const sp = scatter('shells:lagoon', 'lagoon', 170, 53, beach), sc = sp.length / 3;
    const sm = new THREE.InstancedMesh(sh, mat(), Math.max(1, sc)), c = new THREE.Color();
    for (let i = 0; i < sc; i++) {
      this.m4.compose(this.v.set(sp[i * 3], sp[i * 3 + 1], sp[i * 3 + 2]), this.q.setFromEuler(this.e.set(0, r() * 6, 0)), this.s3.setScalar(0.8 + r() * 0.8));
      sm.setMatrixAt(i, this.m4); sm.setColorAt(i, c.set([0xffd6e0, 0xfff1e0, 0xffb3a0, 0xe8d6ff][i % 4]));
    }
    sm.count = sc; this.groups.lagoon.add(sm);
    const k = new Kit();
    for (let i = 0; i < 16; i++) {
      const a = r() * 6.28, d = LAGOON.r + 0.5 + r() * 3, x = LAGOON.x + Math.cos(a) * d, z = LAGOON.z + Math.sin(a) * d, s = 0.25 + r() * 0.35;
      k.add(new THREE.DodecahedronGeometry(s, 1), [0xd8d2de, 0xe8d6dc, 0xc9d6dc][i % 3], x, heightAt(x, z) + s * 0.3, z, r(), r(), 0, 1.3, 0.6, 1);
    }
    const palm = (x: number, z: number, lean: number) => {
      const y = heightAt(x, z);
      for (let s = 0; s < 6; s++) k.add(new THREE.CylinderGeometry(0.11 - s * 0.008, 0.13 - s * 0.008, 0.5, 7), 0xc9a27e, x + Math.sin(lean) * s * 0.12, y + s * 0.46 + 0.25, z, 0, 0, -lean * 0.4);
      const tx = x + Math.sin(lean) * 0.75, ty = y + 2.9;
      for (let l = 0; l < 6; l++) { const a = (l / 6) * 6.28; k.add(new THREE.SphereGeometry(0.9, 6, 3, 0, 1.2, 0, 3.14), 0x7fcf8a, tx + Math.cos(a) * 0.5, ty - 0.1, z + Math.sin(a) * 0.5, 0.4, -a, 0.3, 1, 0.25, 0.8); }
      k.ball(0.12, 0x8a5a3c, tx + 0.1, ty - 0.2, z + 0.05).ball(0.12, 0x8a5a3c, tx - 0.1, ty - 0.22, z - 0.06);
    };
    palm(B.cx - 14, B.cz - 6, 0.5); palm(B.cx + 13, B.cz - 3, -0.4); palm(B.cx - 10, B.cz + 14, 0.3); palm(B.cx + 15, B.cz + 10, -0.6);
    const ux = B.cx + 7, uz = B.cz - 12, uy = heightAt(ux, uz);
    k.cyl(0.04, 0.04, 2.1, 0xffffff, ux, uy, uz).add(new THREE.ConeGeometry(1.4, 0.55, 8), 0xff9ec4, ux, uy + 2.1, uz)
      .box(0.8, 0.03, 1.6, 0xfff1f6, ux - 0.6, heightAt(ux - 0.6, uz + 1) + 0.02, uz + 1).box(0.8, 0.03, 1.6, 0x9ad8ff, ux + 0.6, heightAt(ux + 0.6, uz + 1) + 0.02, uz + 1);
    this.statics('lagoon', k);
  }

  /** cloud sea: puffs along each biome's shore, below the cliffs */
  private buildClouds(id: BiomeId) {
    const B = BIOMES[id], r = rand(91 + id.length * 13), base: Bob['base'] = [];
    const N = id === 'prairie' ? 150 : 96, R0 = id === 'prairie' ? 20 : B.r - 4;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + r() * 0.05, dx = Math.cos(a), dz = Math.sin(a);
      let d = R0;
      while (d < R0 + 22 && landInfo(B.cx + dx * d, B.cz + dz * d).L > -0.5) d += 0.7;
      if (d >= R0 + 22) continue;
      const far = d + 0.5 + r() * 6, x = B.cx + dx * far, z = B.cz + dz * far;
      if (landInfo(x, z).L > -1.5) continue;                       // a land bridge continues here
      base.push({ x, y: (id === 'cliffs' ? 1.5 : -2.6) + r() * 2.2, z, s: 1.6 + r() * 2.6, p: r() * 6 });
    }
    if (id === 'cliffs') for (let i = 0; i < 22; i++) { const a = (i / 22) * 6.28; base.push({ x: SKY.x + Math.cos(a) * (SKY.r + 2 + r() * 3), y: 1 + r() * 2.5, z: SKY.z + Math.sin(a) * (SKY.r + 2 + r() * 3), s: 1.5 + r() * 2, p: r() * 6 }); }
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshMatcapMaterial({ matcap: mat().matcap!, color: 0xffffff }), Math.max(1, base.length));
    mesh.frustumCulled = false; this.groups[id].add(mesh); this.clouds.push({ mesh, base });
  }

  /** stream: show the biome you stand in + neighbours within reach; animate only what is visible */
  update(px: number, pz: number, t: number) {
    for (const id of BIOME_IDS) {
      const B = BIOMES[id], d = Math.hypot(px - B.cx, pz - B.cz) - (id === 'prairie' ? 27 : B.r + (id === 'cliffs' ? 12 : 0));
      this.groups[id].visible = d < 26;
    }
    for (const c of this.chunks) c.visible = Math.hypot(px - c.userData.c[0], pz - c.userData.c[1]) < 52;
    for (const c of this.clouds) {
      if (!c.mesh.parent?.visible) continue;
      for (let i = 0; i < c.base.length; i++) {
        const b = c.base[i];
        this.m4.compose(this.v.set(b.x + Math.sin(t * 0.1 + b.p) * 0.4, b.y + Math.sin(t * 0.35 + b.p) * 0.25, b.z), this.q.identity(), this.s3.set(b.s * 1.25, b.s * 0.75, b.s));
        c.mesh.setMatrixAt(i, this.m4);
      }
      c.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const k of this.koi) {
      if (!k.mesh.parent?.visible) continue;
      for (let i = 0; i < k.mesh.count; i++) { const [x, y, z, yaw] = k.path(t, i); this.m4.compose(this.v.set(x, y, z), this.q.setFromEuler(this.e.set(0, yaw, 0)), this.s3.setScalar(1)); k.mesh.setMatrixAt(i, this.m4); }
      k.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
