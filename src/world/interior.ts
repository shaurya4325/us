// InteriorHouseScene: every built room + auto-stitched hallways in ONE scene (no fades between rooms).
// Static walls/floors/furniture for each floor are merged into a single draw call.
import * as THREE from 'three';
import { Kit, mat, basic, labelSprite, skyTexture, softDot, waterMaterial, disposeTree } from './gfx';
import { ROOMS, type RoomCell, type RoomType } from './catalog';
import type { EngineAPI, Interactable, SceneAPI, WorldDoc } from './types';
import type { Who } from '../config/people';

const SP = 12, H = 4.5, LV = 3.4, WALL = 3, DOOR = 1.2;
type Spot = { key: string; x: number; z: number; label: string; icon: string; r?: number };
type Col = [number, number, number];
interface Built { spots: Spot[]; cols: Col[]; extras?: (g: THREE.Group, ox: number, oy: number, oz: number, u: { value: number }) => void; pool?: [number, number, number, number] }

// furniture layouts in room-local coords (x→right, z→camera). Back-left corner is kept free for stairs.
const LAYOUT: Record<RoomType, (k: Kit, g: Kit) => Built> = {
  bedroom: (k, g) => {
    k.box(2.6, 0.5, 3.0, 0xf7d9e4, 2.4, 0, -2.8).box(2.6, 0.18, 3.0, 0xffffff, 2.4, 0.5, -2.8).box(2.6, 1.2, 0.2, 0xd98fae, 2.4, 0, -4.3)
      .ball(0.32, 0xfff1f6, 1.8, 0.85, -3.8, 1.3, 0.5, 0.8).ball(0.32, 0xfff1f6, 3.0, 0.85, -3.8, 1.3, 0.5, 0.8).box(2.62, 0.08, 1.6, 0xff9ec4, 2.4, 0.66, -2.0);
    for (const [x, z] of [[1.15, -4.25], [3.65, -4.25], [1.15, -1.35], [3.65, -1.35]]) k.cyl(0.05, 0.05, 2.4, 0xe8c6a0, x, 0, z);
    k.box(2.7, 0.06, 3.1, 0xffe3ee, 2.4, 2.4, -2.8);
    k.box(0.4, 1.4, 1.8, 0xc08a5e, -4.2, 0, 1).ball(0.2, 0x3a1630, -4.1, 1.55, 0.4).ball(0.2, 0xf9c9dc, -4.1, 1.55, 1.0).ball(0.2, 0xa8746b, -4.1, 1.55, 1.6);
    k.box(0.3, 2.0, 1.2, 0xe8c6a0, -4.25, 0, -1.6).box(0.05, 1.6, 0.9, 0xcfe9ff, -4.08, 0.2, -1.6);
    k.cyl(1.4, 1.4, 0.02, 0xffc6dc, 0, 0, 1, 24);
    for (let i = 0; i < 14; i++) g.ball(0.06, [0xfff0b0, 0xffb3d4][i % 2], -1 + i * 0.4, 2.6 + Math.sin(i) * 0.12, -4.35, 1, 1, 1, 0);
    return { spots: [{ key: 'bed', x: 2.4, z: -0.8, label: 'Snuggle up', icon: '🛏️' }, { key: 'plush', x: -3.5, z: 1, label: 'Squeeze a plushie', icon: '🧸' }, { key: 'mirror', x: -3.5, z: -1.6, label: 'Change outfit', icon: '🪞' }],
      cols: [[2.4, -2.8, 1.6], [-4.1, 1, 0.8], [-4.2, -1.6, 0.6]] };
  },
  kitchen: (k, g) => {
    k.box(5.0, 0.9, 1.0, 0xfff1e6, 1.8, 0, -4.0).box(5.0, 0.06, 1.05, 0xd9b38c, 1.8, 0.9, -4.0)
      .box(1.0, 0.1, 0.8, 0x4a4458, 0, 0.92, -4.0).cyl(0.25, 0.22, 0.3, 0xff9ec4, 0, 1.0, -4.0).box(0.9, 0.7, 0.05, 0x4a4458, 1.4, 0.1, -3.48)
      .box(1.0, 2.1, 0.9, 0xcfe9ff, -4.0, 0, 0.6).box(0.05, 0.05, 0.3, 0x8a8aa0, -3.5, 1.3, 0.3)
      .cyl(0.9, 0.9, 0.08, 0xd9b38c, 1.6, 0.75, 1.3, 16).cyl(0.1, 0.2, 0.75, 0xb98a63, 1.6, 0, 1.3)
      .box(0.5, 0.45, 0.5, 0xff9ec4, 0.3, 0, 1.3).box(0.5, 0.45, 0.5, 0xff9ec4, 2.9, 0, 1.3);
    g.ball(0.12, 0xff7a3d, 0, 0.95, -4.0, 2, 0.3, 1.5, 0);
    return { spots: [{ key: 'stove', x: 0, z: -3.0, label: 'Cook together', icon: '🍳' }, { key: 'table', x: 1.6, z: 2.4, label: 'Share a meal', icon: '🍽️' }, { key: 'fridge', x: -3.3, z: 0.6, label: 'Grab a snack', icon: '🧃' }],
      cols: [[1.8, -4, 1.0], [0, -4, 0.8], [3.6, -4, 0.8], [-4, 0.6, 0.8], [1.6, 1.3, 1.1]] };
  },
  greenhouse: (k, g) => {
    k.box(5, 0.5, 1.0, 0xb98a63, 1.8, 0, -3.9).box(4.9, 0.1, 0.9, 0x7a5a3c, 1.8, 0.5, -3.9).box(1.0, 0.5, 3.5, 0xb98a63, -3.9, 0, 1.6);
    for (let i = 0; i < 9; i++) k.ball(0.22, [0xff7db5, 0xfff07a, 0xffffff, 0xb9a3e8][i % 4], -0.2 + i * 0.5, 0.75, -3.9, 1, 0.8, 1, 0).cyl(0.02, 0.02, 0.3, 0x5aa86a, -0.2 + i * 0.5, 0.5, -3.9);
    for (let i = 0; i < 6; i++) k.ball(0.2, [0xff9ec4, 0xfff07a][i % 2], -3.9, 0.7, 0.2 + i * 0.55, 1, 0.8, 1, 0);
    for (let i = 0; i < 10; i++) g.ball(0.09, 0x9be3a0, -4.3, 2.8 - (i % 3) * 0.4, -4 + i * 0.9, 1, 1, 1, 0);
    k.cyl(0.06, 0.06, 2.6, 0xe8c6a0, 0.9, 0, 1.6).cyl(0.06, 0.06, 2.6, 0xe8c6a0, 3.1, 0, 1.6).box(2.4, 0.08, 0.08, 0xe8c6a0, 2.0, 2.6, 1.6)
      .box(1.8, 0.15, 0.7, 0xffc6dc, 2.0, 0.6, 1.6).box(1.8, 0.6, 0.12, 0xffc6dc, 2.0, 0.7, 1.3);
    return { spots: [{ key: 'beds', x: 1.8, z: -2.9, label: 'Tend the flowers', icon: '🌷' }, { key: 'swing', x: 2.0, z: 2.6, label: 'Swing together', icon: '🪢' }],
      cols: [[1.8, -3.9, 1.0], [-3.9, 1.6, 0.9], [2.0, 1.6, 1.0]] };
  },
  pool: (k, g) => {
    k.box(5.6, 0.12, 0.4, 0xffffff, 1.0, 0, -1.7).box(5.6, 0.12, 0.4, 0xffffff, 1.0, 0, 2.7).box(0.4, 0.12, 4.0, 0xffffff, -1.6, 0, 0.5).box(0.4, 0.12, 4.0, 0xffffff, 3.6, 0, 0.5);
    k.add(new THREE.TorusGeometry(0.3, 0.1, 6, 12), 0xff3e8a, 0.2, -0.15, 0.2, Math.PI / 2).add(new THREE.TorusGeometry(0.3, 0.1, 6, 12), 0xfff07a, 2.2, -0.15, 1.2, Math.PI / 2);
    k.cyl(1.0, 1.0, 0.5, 0xffffff, -3.2, 0, 3.0, 16);
    k.box(0.8, 0.35, 1.8, 0xffc6dc, 3.7, 0, -3.6).box(0.8, 0.35, 1.8, 0xffc6dc, 2.4, 0, -3.6);
    g.ball(0.5, 0xffffff, -3.2, 1.0, 3.0, 1.4, 0.3, 1.4, 1);
    return { spots: [{ key: 'swim', x: 1.0, z: -2.3, label: 'Swim together', icon: '🏊' }, { key: 'jacuzzi', x: -3.2, z: 1.6, label: 'Relax in the jacuzzi', icon: '♨️' }],
      cols: [[-3.2, 3.0, 1.1], [3.7, -3.6, 0.6], [2.4, -3.6, 0.6]], pool: [-1.4, -1.5, 3.4, 2.5],
      extras: (gr, ox, oy, oz, u) => {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 4.0), waterMaterial(u)); w.rotation.x = -Math.PI / 2; w.position.set(ox + 1.0, oy + 0.04, oz + 0.5); gr.add(w);
        const j = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), waterMaterial(u, '#5fd0d6', '#d6fbff')); j.rotation.x = -Math.PI / 2; j.position.set(ox - 3.2, oy + 0.52, oz + 3.0); gr.add(j);
      } };
  },
  cinema: (k, g) => {
    g.box(5.0, 2.4, 0.05, 0xfff6fa, 1.4, 0.6, -4.42);
    k.box(5.4, 0.3, 0.12, 0x2b0f1f, 1.4, 0.3, -4.38).box(5.4, 0.3, 0.12, 0x2b0f1f, 1.4, 3.0, -4.38)
      .ball(0.6, 0xff3e8a, 0.6, 0.35, 0, 1.2, 0.6, 1.2).ball(0.6, 0x9fd8ff, 2.3, 0.35, 0, 1.2, 0.6, 1.2)
      .box(0.7, 1.4, 0.7, 0xd91663, -3.9, 0, 0.6).box(0.6, 0.5, 0.6, 0xfff0c8, -3.9, 1.4, 0.6)
      .box(1.6, 0.8, 1.0, 0x6b2547, 3.0, 0, 2.8).box(1.4, 0.05, 0.8, 0x9fd8ff, 3.0, 0.8, 2.8);
    return { spots: [{ key: 'screen', x: 1.4, z: -1.6, label: 'Movie night', icon: '🎬' }, { key: 'popcorn', x: -3.3, z: 0.6, label: 'Popcorn!', icon: '🍿' }, { key: 'arcade', x: 3.0, z: 1.8, label: 'Play the Velvet Arcade', icon: '🕹️' }],
      cols: [[0.6, 0, 0.7], [2.3, 0, 0.7], [-3.9, 0.6, 0.6], [3.0, 2.8, 0.9]] };
  },
  observatory: (k, g) => {
    k.cyl(0.35, 0.45, 0.4, 0x7d5a3c, 1.5, 0, -2.5).cyl(0.05, 0.05, 1.0, 0xc9a26b, 1.5, 0.4, -2.5).add(new THREE.CylinderGeometry(0.12, 0.18, 1.4, 10), 0xe0b25a, 1.5, 1.6, -2.8, -0.8)
      .box(1.8, 0.9, 0.8, 0x24161c, -3.4, 0, 1.2).box(1.6, 0.06, 0.3, 0xffffff, -3.4, 0.9, 1.5).box(0.4, 0.5, 0.4, 0x3a1630, -3.4, 0, 2.2)
      .box(0.9, 0.7, 0.7, 0xc08a5e, 3.6, 0, 1.5).cyl(0.3, 0.3, 0.03, 0x24161c, 3.6, 0.7, 1.5, 16);
    for (let i = 0; i < 40; i++) g.ball(0.04 + (i % 3) * 0.02, 0xfff6c8, -4 + (i * 2.17) % 8.5, 1.2 + (i * 1.37) % 1.7, -4.4, 1, 1, 1, 0);
    return { spots: [{ key: 'telescope', x: 1.5, z: -1.4, label: 'Stargaze', icon: '🔭' }, { key: 'piano', x: -3.4, z: 2.6, label: 'Play our song', icon: '🎹' }, { key: 'vinyl', x: 3.6, z: 2.6, label: 'Change the music', icon: '💿' }],
      cols: [[1.5, -2.5, 0.6], [-3.4, 1.2, 1.0], [3.6, 1.5, 0.6]] };
  },
  cuddle: (k) => {
    k.box(3.2, 0.5, 2.4, 0xffc6dc, 2.4, 0, -3.2).ball(0.6, 0xfff1f6, 1.2, 0.8, -3.6).ball(0.6, 0xf5a3c7, 2.4, 0.8, -3.8).ball(0.6, 0xfff1f6, 3.6, 0.8, -3.6)
      .add(new THREE.ConeGeometry(1.9, 1.6, 4), 0xffe3ee, 2.4, 2.2, -3.2, 0, Math.PI / 4);
    const plush = (x: number, z: number, body: number, ear: number) => k.ball(0.55, body, x, 0.55, z).ball(0.42, body, x, 1.25, z + 0.05).ball(0.13, ear, x - 0.25, 1.65, z, 0.7, 1.6, 0.6).ball(0.13, ear, x + 0.25, 1.65, z, 0.7, 1.6, 0.6)
      .ball(0.05, 0x24161c, x - 0.14, 1.3, z + 0.43).ball(0.05, 0x24161c, x + 0.14, 1.3, z + 0.43).ball(0.07, 0xff9ab8, x, 1.17, z + 0.45, 1.4, 0.6, 0.5);
    plush(-2.4, 1.2, 0x3a1630, 0xff3e8a); plush(0, 1.8, 0xf9c9dc, 0xf5a3c7); plush(2.4, 1.6, 0xa8746b, 0x7e5149);
    k.cyl(2.2, 2.2, 0.02, 0xfff1f6, 0, 0, 1.6, 24);
    return { spots: [{ key: 'kuro', x: -2.4, z: 2.4, label: 'Squeeze Kuro', icon: '🖤' }, { key: 'mochi', x: 0, z: 3.0, label: 'Squeeze Mochi', icon: '🩷' }, { key: 'coco', x: 2.4, z: 2.8, label: 'Squeeze Coco', icon: '🤎' }, { key: 'fort', x: 2.4, z: -1.6, label: 'Hide in the pillow fort', icon: '🏰' }],
      cols: [[-2.4, 1.2, 0.6], [0, 1.8, 0.6], [2.4, 1.6, 0.6], [2.4, -3.4, 1.4]] };
  },
  nursery: (k) => {
    k.cyl(0.7, 0.7, 0.3, 0xffd27a, 1.8, 0, -3.5, 14).cyl(0.7, 0.7, 0.3, 0xb9e3ff, 3.6, 0, -3.5, 14)
      .cyl(0.25, 0.2, 0.15, 0xff9ec4, -3.6, 0, 0.8).cyl(0.25, 0.2, 0.15, 0x9fd8ff, -3.6, 0, 1.6)
      .add(new THREE.TorusGeometry(0.6, 0.25, 8, 14, Math.PI), 0xff7db5, 0.6, 0, 1.6).box(1.2, 0.8, 0.8, 0xfff1f6, 3.5, 0, 2.3);
    return { spots: [{ key: 'bowls', x: -2.8, z: 1.2, label: 'Feed the pets', icon: '🦴' }, { key: 'groom', x: 3.5, z: 1.4, label: 'Groom the pets', icon: '🪮' }, { key: 'beds', x: 2.6, z: -2.4, label: 'Nap with the pets', icon: '💤' }],
      cols: [[1.8, -3.5, 0.7], [3.6, -3.5, 0.7], [3.5, 2.3, 0.7]] };
  },
  gallery: (k, g) => {
    for (let i = 0; i < 3; i++) k.box(1.4, 1.7, 0.08, 0xd9b38c, i * 1.9, 0.75, -4.44);
    k.box(0.9, 0.9, 0.9, 0xfff1f6, 2.0, 0, 0.6).add(new THREE.CylinderGeometry(0.2, 0.12, 0.4, 10), 0xffd27a, 2.0, 1.1, 0.6).ball(0.14, 0xffd27a, 2.0, 1.45, 0.6)
      .box(0.08, 1.6, 2.4, 0xfff6e8, -4.44, 0.6, 2.0);
    for (let i = 0; i < 6; i++) g.box(0.06, 0.25, 0.5, [0xff9ec4, 0xfff07a, 0x9fd8ff][i % 3], -4.38, 0.9 + (i % 3) * 0.45, 1.3 + Math.floor(i / 3) * 1.1);
    return { spots: [{ key: 'frames', x: 1.9, z: -3.2, label: 'Look at our memories', icon: '🖼️' }, { key: 'wishwall', x: -3.5, z: 2.0, label: 'Add to our wishlist', icon: '💍' }, { key: 'trophy', x: 2.0, z: 1.8, label: 'Our milestones', icon: '🏆' }],
      cols: [[2.0, 0.6, 0.7]],
      extras: (gr, ox, oy, oz) => {
        const loader = new THREE.TextureLoader(), base = import.meta.env.BASE_URL;
        ['arushi-happy-1', 'arushi-cute-1', 'arushi-chill-1'].forEach((p, i) => {
          const t = loader.load(`${base}photos/arushi/${p}.webp`); t.colorSpace = THREE.SRGBColorSpace;
          const m = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.45), new THREE.MeshBasicMaterial({ map: t }));
          m.position.set(ox + i * 1.9, oy + 1.6, oz - 4.39); gr.add(m);
        });
      } };
  },
  rooftop: (k, g) => {
    for (let i = 0; i < 6; i++) g.ball(0.22, [0xffb35c, 0xff7db5][i % 2], -3 + i * 1.4, 2.6, -4.2, 1, 1.3, 1, 1);
    k.cyl(0.06, 0.06, 1.6, 0x8a5a3c, 0, 0, -2.6).cyl(0.06, 0.06, 1.6, 0x8a5a3c, 3.4, 0, -2.6)
      .add(new THREE.CylinderGeometry(0.5, 0.5, 3.2, 10, 1, true, 0, Math.PI), 0xfff1f6, 1.7, 1.0, -2.6, 0, 0, Math.PI / 2)
      .cyl(0.3, 0.25, 0.6, 0xcfe9ff, -3.2, 0, 1.6).cyl(0.18, 0.18, 0.1, 0xc08a5e, -3.2, 0.6, 1.6);
    g.ball(0.18, 0xfff07a, -3.2, 0.3, 1.6, 1, 1, 1, 0);
    return { spots: [{ key: 'hammock', x: 1.7, z: -1.4, label: 'Lie in the hammock', icon: '🌙' }, { key: 'jar', x: -3.2, z: 2.6, label: 'Make a wish', icon: '🫙' }],
      cols: [[0, -2.6, 0.25], [3.4, -2.6, 0.25], [-3.2, 1.6, 0.45]] };
  },
};

interface RoomRt { c: RoomCell; ox: number; oy: number; oz: number; b: Built; hasUp: boolean }

export class Interior implements SceneAPI {
  kind = 'inside' as const;
  scene = new THREE.Scene();
  private uTime = { value: 0 };
  private rooms: RoomRt[] = [];
  private halls: { x0: number; x1: number; z0: number; z1: number; y: number }[] = [];
  private levels: THREE.Group[] = [new THREE.Group(), new THREE.Group()];
  private exit: [number, number] = [0, 4];
  private sig = '';
  private lights!: THREE.Points;

  constructor(w: WorldDoc) {
    this.scene.background = skyTexture('#2b0f1f', '#4a1d33', '#170912');
    this.scene.add(this.levels[0], this.levels[1]);
    this.build(w);
  }

  private build(w: WorldDoc) {
    this.levels.forEach((l) => { disposeTree(l); l.clear(); });
    const cells = Object.values(w.rooms ?? {}) as RoomCell[];
    this.sig = JSON.stringify(Object.keys(w.rooms ?? {}).sort());
    const at = (gx: number, gz: number, lv: number) => cells.find((c) => c.gx === gx && c.gz === gz && c.lv === lv);
    this.rooms = []; this.halls = [];
    const kits = [new Kit(), new Kit()], glows = [new Kit(), new Kit()];
    const front = cells.filter((c) => c.lv === 0 && c.gx === 0).sort((a, b) => b.gz - a.gz)[0] ?? cells[0];
    const sparkle: number[] = [];
    for (const c of cells) {
      const ox = c.gx * SP, oz = c.gz * SP, oy = c.lv * LV, k = kits[c.lv], g = glows[c.lv], R = ROOMS[c.type];
      const hasUp = c.lv === 0 && !!at(c.gx, c.gz, 1);
      // floor (upper floors leave a hole above the stairs)
      if (c.lv === 1) { k.box(H * 2, 0.2, H * 2 - 1.6, R.floor, ox, oy - 0.2, oz + 0.8); k.box(H * 2 - 3.2, 0.2, 1.6, R.floor, ox + 1.6, oy - 0.2, oz - H + 0.8); }
      else k.box(H * 2, 0.2, H * 2, R.floor, ox, oy - 0.2, oz);
      // walls: back (-z) & left (-x) full height; front (+z) & right (+x) low cutaway walls; doorways to neighbours
      const nb = { l: at(c.gx - 1, c.gz, c.lv), r: at(c.gx + 1, c.gz, c.lv), b: at(c.gx, c.gz - 1, c.lv), f: at(c.gx, c.gz + 1, c.lv) };
      const wallX = (x: number, h: number, gap: boolean) => {
        if (!gap) return k.box(0.2, h, H * 2, R.wall, ox + x, oy, oz);
        k.box(0.2, h, H - DOOR, R.wall, ox + x, oy, oz - (H + DOOR) / 2).box(0.2, h, H - DOOR, R.wall, ox + x, oy, oz + (H + DOOR) / 2);
        if (h > 1) k.box(0.2, h - 2.3, DOOR * 2, R.wall, ox + x, oy + 2.3, oz).box(0.3, 0.15, DOOR * 2 + 0.3, 0xd9b38c, ox + x, oy + 2.25, oz);
      };
      const wallZ = (z: number, h: number, gap: boolean) => {
        if (!gap) return k.box(H * 2, h, 0.2, R.wall, ox, oy, oz + z);
        k.box(H - DOOR, h, 0.2, R.wall, ox - (H + DOOR) / 2, oy, oz + z).box(H - DOOR, h, 0.2, R.wall, ox + (H + DOOR) / 2, oy, oz + z);
        if (h > 1) k.box(DOOR * 2, h - 2.3, 0.2, R.wall, ox, oy + 2.3, oz + z).box(DOOR * 2 + 0.3, 0.15, 0.3, 0xd9b38c, ox, oy + 2.25, oz + z);
      };
      const isFront = c === front;
      wallX(-H, WALL, !!nb.l); wallZ(-H, WALL, !!nb.b);
      wallX(H, 0.55, !!nb.r); wallZ(H, 0.55, !!nb.f || isFront);
      k.box(H * 2, 0.12, 0.3, 0xfff1f6, ox, oy + WALL, oz - H).box(0.3, 0.12, H * 2, 0xfff1f6, ox - H, oy + WALL, oz);
      if (isFront) {
        k.box(0.15, 2.2, 0.25, 0x9a6a46, ox - DOOR, oy, oz + H).box(0.15, 2.2, 0.25, 0x9a6a46, ox + DOOR, oy, oz + H).box(DOOR * 2 + 0.15, 0.2, 0.25, 0x9a6a46, ox, oy + 2.2, oz + H);
        g.box(DOOR * 2 - 0.2, 0.04, 0.6, 0xffd27a, ox, oy + 0.01, oz + H + 0.2);
        this.exit = [ox, oz + H - 0.6];
      }
      // hallways to the right and front neighbours (each pair once)
      if (nb.r) this.hall(k, g, ox + H, ox + SP - H, oz - DOOR + 0.1, oz + DOOR - 0.1, oy, R.floor, true);
      if (nb.f) this.hall(k, g, ox - DOOR + 0.1, ox + DOOR - 0.1, oz + H, oz + SP - H, oy, R.floor, false);
      // stairs up (back-left corner)
      if (hasUp) for (let s = 0; s < 8; s++) k.box(3.0 / 8 + 0.02, (LV * (s + 1)) / 8, 1.4, 0xd9b38c, ox - 1.3 - (s + 0.5) * (3.0 / 8), oy, oz - H + 0.8);
      const b = LAYOUT[c.type](new KitProxy(k, ox, oy, oz) as any, new KitProxy(g, ox, oy, oz) as any);
      this.rooms.push({ c, ox, oy, oz, b, hasUp });
      for (let i = 0; i < 6; i++) sparkle.push(ox - 4 + Math.random() * 8, oy + 1 + Math.random() * 2, oz - 4 + Math.random() * 8);
    }
    for (const lv of [0, 1]) {
      if (kits[lv].parts.length) this.levels[lv].add(new THREE.Mesh(kits[lv].build(), mat()));
      if (glows[lv].parts.length) this.levels[lv].add(new THREE.Mesh(glows[lv].build(), basic(0xffffff, { vertexColors: true })));
    }
    for (const r of this.rooms) {
      r.b.extras?.(this.levels[r.c.lv], r.ox, r.oy, r.oz, this.uTime);
      const l = labelSprite(`${ROOMS[r.c.type].icon} ${ROOMS[r.c.type].name.replace(/^"|"/g, '')}`, '#F5A3C7', 1.25, false);
      l.position.set(r.ox - 1.5, r.oy + WALL + 0.6, r.oz - H + 0.3); this.levels[r.c.lv].add(l);
    }
    const ex = labelSprite('Exit to the meadow', '#FFD27A', 1.0, false); ex.position.set(this.exit[0], 1.6, this.exit[1] + 1); this.levels[0].add(ex);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(sparkle, 3));
    this.lights = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.35, map: softDot(), color: 0xffd2e6, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.levels[0].add(this.lights);
  }

  private hall(k: Kit, g: Kit, x0: number, x1: number, z0: number, z1: number, y: number, floor: number, alongX: boolean) {
    k.box(x1 - x0, 0.2, z1 - z0, floor, (x0 + x1) / 2, y - 0.2, (z0 + z1) / 2);
    // back side wall of the hallway + a warm arch at each end
    if (alongX) { k.box(x1 - x0, WALL, 0.2, 0xe8c6a0, (x0 + x1) / 2, y, z0 - 0.1).box(x1 - x0, 0.4, 0.2, 0xe8c6a0, (x0 + x1) / 2, y, z1 + 0.1); }
    else { k.box(0.2, WALL, z1 - z0, 0xe8c6a0, x0 - 0.1, y, (z0 + z1) / 2).box(0.2, 0.4, z1 - z0, 0xe8c6a0, x1 + 0.1, y, (z0 + z1) / 2); }
    for (let i = 0; i < 3; i++) {
      const t = (i + 0.5) / 3;
      g.ball(0.1, 0xfff0b0, alongX ? x0 + (x1 - x0) * t : x0 - 0.05, y + 2.4, alongX ? z0 - 0.05 : z0 + (z1 - z0) * t, 1, 1, 1, 0);
    }
    this.halls.push({ x0, x1, z0, z1, y });
  }

  setWorld(w: WorldDoc) {
    if (JSON.stringify(Object.keys(w.rooms ?? {}).sort()) !== this.sig) this.build(w);
  }

  spawn(who: Who): [number, number, number] { return [this.exit[0] + (who === 'shaurya' ? -0.6 : 0.6), 0, this.exit[1] - 1.2]; }

  inPool(x: number, z: number, y: number) {
    for (const r of this.rooms) {
      const p = r.b.pool; if (!p || Math.abs(y - r.oy) > 1.5) continue;
      if (x > r.ox + p[0] && x < r.ox + p[2] && z > r.oz + p[1] && z < r.oz + p[3]) return true;
    }
    return false;
  }

  ground(x: number, z: number, y: number) {
    let best: number | null = null;
    const cand = (h: number) => { if (h <= y + 0.65 && (best === null || h > best)) best = h; };
    for (const r of this.rooms) {
      const lx = x - r.ox, lz = z - r.oz;
      if (Math.abs(lx) > H - 0.3 || Math.abs(lz) > H - 0.3) continue;
      const stair = lx < -1.3 && lz < -H + 1.5;
      if (r.c.lv === 0 && r.hasUp && stair) { cand(r.oy + LV * THREE.MathUtils.clamp((-1.3 - lx) / 3.0, 0, 1)); continue; }
      if (r.c.lv === 1 && stair) continue;
      if (r.b.cols.some(([cx, cz, cr]) => Math.hypot(lx - cx, lz - cz) < cr)) { if (Math.abs(r.oy - y) < 1.6) return null; continue; }
      cand(r.oy + (r.b.pool && this.inPool(x, z, r.oy) ? -0.45 : 0));
    }
    for (const h of this.halls) if (x > h.x0 - 0.3 && x < h.x1 + 0.3 && z > h.z0 && z < h.z1) cand(h.y);
    return best;
  }

  levelOf(y: number) { return y > LV * 0.5 ? 1 : 0; }

  interactables(): Interactable[] {
    const out: Interactable[] = [{ id: 'exit', x: this.exit[0], z: this.exit[1], r: 1.4, label: 'Exit to the meadow', icon: '🚪' }];
    for (const r of this.rooms) for (const s of r.b.spots) out.push({ id: `${r.c.id}:${s.key}`, x: r.ox + s.x, z: r.oz + s.z, y: r.oy, r: s.r ?? 1.5, label: s.label, icon: s.icon });
    return out;
  }

  interact(id: string, E: EngineAPI) {
    if (id === 'exit') return E.exit();
    const key = id.split(':')[1], p = E.player;
    const heart = () => E.fx('heart', p.x, p.y + 1.6, p.z, 10);
    switch (key) {
      case 'bed': E.play('sit', 4); heart(); E.sound('hug'); E.ui('event', { type: 'room', text: 'is snuggled up in the canopy bed' }); break;
      case 'plush': case 'kuro': case 'mochi': case 'coco': E.play('hug', 1.5); E.sound('squeak'); heart(); E.ui('plush', key === 'plush' ? 'mochi' : key); break;
      case 'mirror': E.ui('outfit'); break;
      case 'stove': E.ui('cook'); break;
      case 'table': { const d = Object.entries(E.world.dishes ?? {}).filter(([, n]) => n > 0); E.play('sit', 3); E.toast('🍽️ Dinner for two', d.length ? d.map(([k, n]) => `${k} ×${n}`).join(' · ') : 'Cook something at the stove first'); heart(); break; }
      case 'fridge': E.sound('pop'); E.toast('🧃 Snack time', 'One strawberry milk for you, one for them'); break;
      case 'beds': E.play('pat', 1.2); E.fx('blossom', p.x, p.y + 0.6, p.z, 16); if (Math.random() < 0.5) E.give({ flower: 1 }, p.x, p.y + 1, p.z, 'greenhouse bloom'); else E.toast('🌷 Flowers watered'); break;
      case 'swing': E.play('sit', 4); heart(); E.ui('event', { type: 'room', text: 'is on the loveseat swing, saving you a spot' }); break;
      case 'swim': E.toast('🏊 Hop in!', 'Walk into the pool to swim'); break;
      case 'jacuzzi': E.play('sit', 4); E.fx('spark', p.x, p.y + 0.8, p.z, 12); break;
      case 'screen': E.ui('movie'); break;
      case 'popcorn': E.sound('pop'); E.fx('gold', p.x, p.y + 1.2, p.z, 16); E.toast('🍿 Fresh popcorn', 'Extra butter, as always'); break;
      case 'arcade': E.ui('drawer', 'arcade'); break;
      case 'telescope': E.ui('stars'); break;
      case 'piano': E.ui('piano'); break;
      case 'vinyl': E.ui('music'); break;
      case 'fort': E.play('sit', 4); heart(); break;
      case 'bowls': case 'groom': E.ui('petcare', key); break;
      case 'frames': E.ui('drawer', 'capsule'); break;
      case 'wishwall': case 'jar': E.ui('wish', key); break;
      case 'trophy': E.ui('trophy'); break;
      case 'hammock': E.play('sit', 5); heart(); E.ui('event', { type: 'room', text: 'is in the rooftop hammock under the lanterns' }); break;
    }
  }

  update(dt: number, t: number, E: EngineAPI) {
    this.uTime.value = t;
    const lv = this.levelOf(E.player.y);
    this.levels[1].visible = lv === 1;
    if (this.lights) (this.lights.material as THREE.PointsMaterial).opacity = 0.45 + Math.sin(t * 2) * 0.15;
  }

  dispose() { disposeTree(this.scene); (this.scene.background as THREE.Texture)?.dispose(); }
}

/** offsets a Kit so room layouts can use local coordinates */
class KitProxy {
  constructor(private k: Kit, private ox: number, private oy: number, private oz: number) {}
  add(geo: THREE.BufferGeometry, c: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { this.k.add(geo, c, x + this.ox, y + this.oy, z + this.oz, rx, ry, rz, sx, sy, sz); return this; }
  box(w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0, ry = 0) { this.k.box(w, h, d, c, x + this.ox, y + this.oy, z + this.oz, ry); return this; }
  cyl(rt: number, rb: number, h: number, c: number, x = 0, y = 0, z = 0, seg = 10) { this.k.cyl(rt, rb, h, c, x + this.ox, y + this.oy, z + this.oz, seg); return this; }
  ball(r: number, c: number, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, det = 1) { this.k.ball(r, c, x + this.ox, y + this.oy, z + this.oz, sx, sy, sz, det); return this; }
}
