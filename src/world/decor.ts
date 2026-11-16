// Placeable furniture & decor crafted at the table and the loom. One builder used by the overworld and the house;
// everything placed in a scene is merged into a single draw call.
import * as THREE from 'three';
import { Kit } from './gfx';
import type { Decor } from './types';

/** add one decor piece to the kits (matcap kit k, glowing kit g) at x,y,z rotated by r */
export function addDecor(k: Kit, g: Kit, d: Decor) {
  const { x, y, z } = d, c = Math.cos(d.r), s = Math.sin(d.r);
  const P = (dx: number, dz: number) => [x + dx * c + dz * s, z - dx * s + dz * c] as const;
  switch (d.item) {
    case 'rug': k.add(new THREE.CylinderGeometry(1.1, 1.1, 0.03, 20), 0xd94f86, x, y + 0.015, z, 0, 0, 0, 1, 1, 0.75).add(new THREE.CylinderGeometry(0.8, 0.8, 0.035, 20), 0xffb3d4, x, y + 0.02, z, 0, 0, 0, 1, 1, 0.75); break;
    case 'curtain': { const [ax, az] = P(-0.5, 0), [bx, bz] = P(0.5, 0); k.box(1.4, 0.06, 0.06, 0xc9a26b, x, y + 2.2, z, d.r).add(new THREE.BoxGeometry(0.55, 2.0, 0.06), 0xffb3d4, ax, y + 1.2, az, 0, d.r, 0).add(new THREE.BoxGeometry(0.55, 2.0, 0.06), 0xffb3d4, bx, y + 1.2, bz, 0, d.r, 0); break; }
    case 'lantern': k.cyl(0.04, 0.05, 1.3, 0x7d4f45, x, y, z).box(0.34, 0.06, 0.34, 0x7d4f45, x, y + 1.3, z); g.ball(0.18, 0xffc27a, x, y + 1.12, z, 1, 1.2, 1, 1); break;
    case 'pot': k.cyl(0.22, 0.16, 0.32, 0xd98a6a, x, y, z).ball(0.24, 0x7fcf8a, x, y + 0.42, z, 1, 0.8, 1).ball(0.08, 0xff7db5, x + 0.1, y + 0.6, z + 0.05, 1, 1, 1, 0).ball(0.08, 0xfff07a, x - 0.1, y + 0.58, z - 0.06, 1, 1, 1, 0); break;
    case 'lights': { for (let i = 0; i < 9; i++) { const [px, pz] = P(-1 + i * 0.25, 0); g.ball(0.06, [0xfff0b0, 0xffb3d4, 0x9ad8ff][i % 3], px, y + 2.0 - Math.sin((i / 8) * Math.PI) * 0.35, pz, 1, 1, 1, 0); } const [ax, az] = P(-1.05, 0), [bx, bz] = P(1.05, 0); k.cyl(0.03, 0.03, 2.05, 0x8a5a3c, ax, y, az).cyl(0.03, 0.03, 2.05, 0x8a5a3c, bx, y, bz); break; }
    case 'pillow': k.ball(0.3, 0xff7db5, x - 0.12, y + 0.18, z, 1, 0.55, 0.8).ball(0.3, 0xff7db5, x + 0.12, y + 0.18, z, 1, 0.55, 0.8).add(new THREE.ConeGeometry(0.3, 0.32, 8), 0xff7db5, x, y + 0.12, z + 0.05, Math.PI, 0, 0, 1.3, 1, 0.6); break;
    case 'chime': k.cyl(0.03, 0.03, 1.6, 0xcfc4b8, x, y, z).box(0.6, 0.05, 0.05, 0xcfc4b8, x, y + 1.6, z, d.r); for (let i = 0; i < 4; i++) { const [px, pz] = P(-0.22 + i * 0.15, 0); g.cyl(0.03, 0.03, 0.35, [0x8ff0e6, 0xa8e6ff, 0xc8ffd8, 0xfff0a0][i], px, y + 1.2, pz); } break;
    case 'lamp': k.cyl(0.18, 0.22, 0.12, 0xd8d0e4, x, y, z).cyl(0.03, 0.03, 0.5, 0xd8d0e4, x, y + 0.1, z); g.ball(0.2, 0xfff6d8, x, y + 0.75, z).ball(0.06, 0xfff6d8, x - 0.1, y + 0.98, z, 0.7, 1.8, 0.7).ball(0.06, 0xfff6d8, x + 0.1, y + 0.98, z, 0.7, 1.8, 0.7); break;
    case 'shelf': k.box(1.0, 1.2, 0.35, 0xa8744f, x, y, z, d.r); for (let i = 0; i < 6; i++) { const [px, pz] = P(-0.35 + (i % 3) * 0.3, 0.02); k.box(0.12, 0.3, 0.26, [0x9ad8ff, 0xffb3d4, 0xfff07a][i % 3], px, y + 0.2 + Math.floor(i / 3) * 0.5, pz, d.r); } break;
    case 'plushMochi': case 'plushKuro': case 'plushCoco': case 'plushStar': {
      const body = { plushMochi: 0xf9c9dc, plushKuro: 0x3a1630, plushCoco: 0xa8746b, plushStar: 0xcfe3ff }[d.item]!, ear = { plushMochi: 0xf5a3c7, plushKuro: 0xff3e8a, plushCoco: 0x7e5149, plushStar: 0xfff0a0 }[d.item]!;
      k.ball(0.26, body, x, y + 0.26, z).ball(0.2, body, x, y + 0.6, z).ball(0.07, ear, x - 0.11, y + 0.82, z, 0.7, 1.6, 0.6).ball(0.07, ear, x + 0.11, y + 0.82, z, 0.7, 1.6, 0.6);
      break;
    }
    case 'bouquet': k.cyl(0.06, 0.1, 0.3, 0xfff1f6, x, y, z); for (let i = 0; i < 5; i++) k.ball(0.08, [0xff7db5, 0xfff07a, 0xffffff][i % 3], x + Math.cos(i * 1.3) * 0.08, y + 0.38, z + Math.sin(i * 1.3) * 0.08); break;
    default: k.box(0.4, 0.4, 0.4, 0xffb3d4, x, y, z);
  }
}
/** which items can be placed in the world */
export const PLACEABLE = new Set(['rug', 'curtain', 'lantern', 'pot', 'lights', 'pillow', 'chime', 'lamp', 'shelf', 'plushMochi', 'plushKuro', 'plushCoco', 'plushStar', 'bouquet']);
