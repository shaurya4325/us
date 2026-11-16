// Tiny chibi characters built from merged primitives (7 draws each) with fully procedural animation.
import * as THREE from 'three';
import { Kit, labelSprite, mat } from './gfx';
import type { Look } from '../config/people';
import type { ToolId } from './catalog';

export type Anim = 'idle' | 'walk' | 'jump' | 'swing' | 'hug' | 'kiss' | 'dance' | 'pat' | 'patted' | 'whisper' | 'listen' | 'hands' | 'sit' | 'swim' | 'wave' | 'cast';

const toolGeo = (id: ToolId | 'none') => {
  const k = new Kit();
  if (id === 'hatchet') k.cyl(0.03, 0.03, 0.5, 0x9a6a46, 0, -0.1).box(0.2, 0.14, 0.04, 0xf2b8a0, 0.08, 0.3);
  else if (id === 'pickaxe') k.cyl(0.03, 0.03, 0.52, 0x7d5a3c, 0, -0.1).add(new THREE.TorusGeometry(0.2, 0.035, 5, 10, Math.PI), 0xd9e4ff, 0, 0.38, 0);
  else if (id === 'can') k.cyl(0.11, 0.13, 0.2, 0x8fd3c9, 0, -0.08).cyl(0.02, 0.025, 0.22, 0x8fd3c9, 0.14, 0.02);
  else if (id === 'net') k.cyl(0.025, 0.025, 0.7, 0xc9a26b, 0, -0.1).add(new THREE.TorusGeometry(0.16, 0.02, 5, 12), 0xffffff, 0, 0.66, 0, Math.PI / 2);
  else if (id === 'rod') k.cyl(0.02, 0.03, 0.95, 0x9dc46a, 0, -0.1).ball(0.04, 0xff3e8a, 0, 0.86, 0);
  else return null;
  return k.build();
};

export class Chibi {
  root = new THREE.Group();
  private hips = new THREE.Group(); private head = new THREE.Group();
  private armL = new THREE.Group(); private armR = new THREE.Group(); private legL = new THREE.Group(); private legR = new THREE.Group();
  private cape = new THREE.Group(); private toolHold = new THREE.Group(); private capeMesh: THREE.Mesh;
  private toolMesh: THREE.Mesh | null = null; private tool: ToolId | 'none' = 'none';
  label: THREE.Sprite; private m = mat(); private t = 0; private swingT = 0;
  anim: Anim = 'idle'; animT = 0; speed = 0; handSide: 'L' | 'R' = 'R';

  constructor(look: Look, name: string, color: string) {
    const L = look;
    // torso (+ skirt for her, belt + collar)
    const torso = new Kit().cyl(0.2, 0.25, 0.4, L.outfit, 0, 0.3).cyl(0.13, 0.13, 0.06, L.trim, 0, 0.68);
    if (L.girl) torso.cyl(0.24, 0.36, 0.22, L.outfit, 0, 0.28).cyl(0.36, 0.37, 0.03, L.trim, 0, 0.28);
    else torso.cyl(0.255, 0.255, 0.05, L.trim, 0, 0.36);
    this.hips.add(new THREE.Mesh(torso.build(), this.m));
    // head: big round face, hair cap, eyes with highlights, blush, buns / ponytail for her
    const h = new Kit()
      .ball(0.4, L.skin, 0, 0, 0, 1, 0.95, 0.95, 2)
      .ball(0.43, L.hair, 0, 0.08, -0.05, 1.02, 0.92, 1.0, 2)
      .ball(0.2, L.hair, -0.17, 0.2, 0.25, 1.1, 0.55, 0.6).ball(0.2, L.hair, 0.15, 0.22, 0.27, 1.0, 0.5, 0.6)
      .ball(0.062, 0x24161c, -0.14, -0.04, 0.36, 0.8, 1.15, 0.6).ball(0.062, 0x24161c, 0.14, -0.04, 0.36, 0.8, 1.15, 0.6)
      .ball(0.022, 0xffffff, -0.12, 0.0, 0.405).ball(0.022, 0xffffff, 0.16, 0.0, 0.405)
      .ball(0.06, 0xff9ab8, -0.25, -0.14, 0.3, 1, 0.6, 0.4).ball(0.06, 0xff9ab8, 0.25, -0.14, 0.3, 1, 0.6, 0.4)
      .ball(0.03, 0xc0566f, 0, -0.17, 0.385, 1.4, 0.7, 0.5);
    if (L.girl) {
      h.ball(0.16, L.hair, -0.33, 0.32, -0.08).ball(0.16, L.hair, 0.33, 0.32, -0.08)
        .ball(0.3, L.hair, 0, -0.2, -0.28, 1.25, 1.3, 0.7)
        .ball(0.07, 0xff3e8a, 0.3, 0.3, 0.12).ball(0.05, 0xffd27a, 0.3, 0.3, 0.17);
    } else {
      h.ball(0.12, L.hair, 0.05, 0.42, 0.02, 1.2, 0.7, 1);
    }
    this.head.add(new THREE.Mesh(h.build(), this.m));
    this.head.position.y = 0.98;
    this.hips.add(this.head);
    // limbs
    const arm = () => new THREE.Mesh(new Kit().cyl(0.07, 0.08, 0.3, L.outfit, 0, -0.3).ball(0.075, L.skin, 0, -0.33, 0).build(), this.m);
    const leg = () => new THREE.Mesh(new Kit().cyl(0.075, 0.07, 0.22, L.girl ? L.skin : L.outfit, 0, -0.26).ball(0.09, L.shoe, 0, -0.27, 0.03, 1, 0.7, 1.3).build(), this.m);
    this.armL.add(arm()); this.armR.add(arm());
    this.armL.position.set(-0.27, 0.64, 0); this.armR.position.set(0.27, 0.64, 0);
    this.legL.add(leg()); this.legR.add(leg());
    this.legL.position.set(-0.11, 0.33, 0); this.legR.position.set(0.11, 0.33, 0);
    this.toolHold.position.set(0, -0.34, 0.06); this.toolHold.rotation.x = Math.PI / 2.4;
    this.armR.add(this.toolHold);
    // little flowing cape / scarf
    const capeGeo = new Kit().add(new THREE.CylinderGeometry(0.2, 0.4, 0.55, 10, 1, true, Math.PI * 0.55, Math.PI * 0.9), L.cape, 0, -0.27, -0.02)
      .cyl(0.2, 0.22, 0.07, L.cape, 0, -0.04).build();
    this.capeMesh = new THREE.Mesh(capeGeo, mat({ side: THREE.DoubleSide }));
    this.cape.add(this.capeMesh); this.cape.position.set(0, 0.72, -0.04);
    this.hips.add(this.armL, this.armR, this.legL, this.legR, this.cape);
    this.root.add(this.hips);
    this.label = labelSprite(name, color, 1.0);
    this.label.position.y = 1.85;
    this.root.add(this.label);
  }

  setCape(c: number) {
    const col = this.capeMesh.geometry.attributes.color as THREE.BufferAttribute, k = new THREE.Color(c);
    for (let i = 0; i < col.count; i++) col.setXYZ(i, k.r, k.g, k.b);
    col.needsUpdate = true;
  }
  setTool(id: ToolId | 'none') {
    if (id === this.tool) return;
    this.tool = id;
    if (this.toolMesh) { this.toolHold.remove(this.toolMesh); this.toolMesh.geometry.dispose(); this.toolMesh = null; }
    const g = toolGeo(id);
    if (g) { this.toolMesh = new THREE.Mesh(g, this.m); this.toolHold.add(this.toolMesh); }
  }
  play(a: Anim) { if (a !== this.anim) { this.anim = a; this.animT = 0; } }
  swing() { this.swingT = 0.32; }

  /** procedural animation; speed = ground speed (units/s) */
  update(dt: number, airborne: boolean) {
    this.t += dt; this.animT += dt;
    const t = this.t, a = this.anim, moving = this.speed > 0.2;
    const ph = t * (6 + this.speed * 1.6);
    let bob = 0, legA = 0, armA = 0, armRA = 0, armLz = 0, armRz = 0, headTilt = 0, lean = 0, spin = 0, headYaw = 0, headDown = 0, squish = 1, sway = 0;
    if (airborne) { legA = 0.5; armA = -2.4; }
    else if (a === 'swim') { bob = -0.35 + Math.sin(t * 3) * 0.05; armA = Math.sin(t * 5) * 1.6; legA = Math.sin(t * 6) * 0.5; }
    else if (moving || a === 'walk') { bob = Math.abs(Math.sin(ph)) * 0.07; legA = Math.sin(ph) * 0.75; armA = -Math.sin(ph) * 0.65; lean = 0.08; }
    else { bob = Math.sin(t * 2.2) * 0.012; armLz = 0.1; armRz = -0.1; }
    if (!moving && !airborne) {
      const k = Math.min(1, this.animT * 3);                                     // ease into every pose
      if (a === 'hug') { armA = -1.55 * k; armLz = 1.15 * k; armRz = -1.15 * k; lean = 0.3 * k; headTilt = 0.25 * k; sway = Math.sin(t * 3) * 0.1 * k; bob = Math.abs(Math.sin(t * 3)) * 0.03; }
      if (a === 'kiss') { lean = 0.36 * k; headTilt = 0.34 * k; bob = 0.07 * k; armA = -0.7 * k; armLz = 0.6 * k; armRz = -0.6 * k; legA = -0.15 * k; }
      if (a === 'dance') { spin = this.animT * 7; bob = Math.abs(Math.sin(t * 8)) * 0.22; armLz = 2.5; armRz = -2.5; legA = Math.sin(t * 8) * 0.5; }
      if (a === 'pat') { armRA = (-2.45 + Math.sin(t * 14) * 0.32) * k; armRz = 0.5 * k; lean = 0.2 * k; armLz = 0.2; }
      if (a === 'patted') { headDown = (0.32 + Math.sin(t * 14) * 0.12) * k; squish = 1 - Math.abs(Math.sin(t * 14)) * 0.09 * k; bob = -0.04 * k; armLz = 0.35; armRz = -0.35; }
      if (a === 'whisper') { lean = 0.3 * k; headTilt = -0.35 * k; armRA = -2.0 * k; armRz = 0.75 * k; }
      if (a === 'listen') { headTilt = 0.35 * k; bob = Math.abs(Math.sin(t * 5)) * 0.03; armLz = 0.3; armRz = -0.3; }
      if (a === 'hands') { if (this.handSide === 'R') { armRA = -0.35; armRz = 0.75; } else { armA = -0.35; armLz = -0.75; } }
      if (a === 'wave') { armRA = -2.6; armRz = -0.4 + Math.sin(t * 10) * 0.4; }
      if (a === 'sit') { legA = -1.4; bob = -0.18; }
      if (a === 'cast') { armRA = -1.2 + Math.sin(t * 2) * 0.1; }
    }
    if (a === 'hands' && moving) { if (this.handSide === 'R') { armRA = -0.3; armRz = 0.6; } else { armA = -0.3; armLz = -0.6; } }
    // tool swing overrides the right arm
    if (this.swingT > 0) {
      this.swingT -= dt;
      const k = 1 - this.swingT / 0.32;
      armRA = k < 0.35 ? -2.8 * (k / 0.35) : -2.8 + 3.4 * ((k - 0.35) / 0.65);
    }
    this.hips.position.y = bob;
    this.hips.rotation.x = lean; this.hips.rotation.y = spin; this.hips.rotation.z = sway;
    this.head.scale.set(2 - squish, squish, 1);
    this.head.rotation.z = headTilt; this.head.rotation.y = headYaw;
    this.head.rotation.x = -lean * 0.5 + headDown + Math.sin(t * 1.7) * 0.02;
    this.legL.rotation.x = legA; this.legR.rotation.x = a === 'sit' ? legA : -legA;
    this.armL.rotation.x = armA; this.armR.rotation.x = armRA || -armA;
    this.armL.rotation.z = armLz; this.armR.rotation.z = armRz;
    // cape trails behind with speed and flutters
    this.cape.rotation.x = 0.12 + Math.min(this.speed, 5) * 0.18 + Math.sin(t * 9) * 0.05 * (moving ? 1 : 0.3) + (airborne ? 0.6 : 0);
    this.label.position.y = 1.85 + bob;
  }
  dispose() {
    this.root.traverse((o: any) => { if (o.isMesh) o.geometry.dispose(); });
    this.m.dispose(); (this.capeMesh.material as THREE.Material).dispose();
    (this.label.material as THREE.SpriteMaterial).map?.dispose(); this.label.material.dispose();
  }
}

/** small companion pets (one merged mesh each) */
export function petMesh(body: number, ear: number, kind: string) {
  const k = new Kit().ball(0.22, body, 0, 0.24, 0, 1.1, 0.9, 1.3).ball(0.18, body, 0, 0.42, 0.2)
    .ball(0.03, 0x221822, -0.07, 0.45, 0.36).ball(0.03, 0x221822, 0.07, 0.45, 0.36).ball(0.035, 0xff9ab8, 0, 0.4, 0.38);
  if (kind === 'bunny') k.ball(0.06, ear, -0.07, 0.66, 0.16, 0.6, 1.9, 0.5).ball(0.06, ear, 0.07, 0.66, 0.16, 0.6, 1.9, 0.5);
  else if (kind === 'kitten') k.add(new THREE.ConeGeometry(0.06, 0.12, 4), ear, -0.09, 0.58, 0.18).add(new THREE.ConeGeometry(0.06, 0.12, 4), ear, 0.09, 0.58, 0.18).ball(0.05, ear, 0, 0.3, -0.3, 0.6, 0.6, 1.5);
  else if (kind === 'panda') k.ball(0.06, ear, -0.12, 0.56, 0.18).ball(0.06, ear, 0.12, 0.56, 0.18).ball(0.08, ear, 0, 0.26, -0.32, 0.8, 0.8, 2).ball(0.06, 0xffffff, 0, 0.4, 0.33, 1.3, 0.7, 0.5);
  else k.ball(0.07, ear, -0.15, 0.5, 0.18, 0.6, 1, 0.6).ball(0.07, ear, 0.15, 0.5, 0.18, 0.6, 1, 0.6).ball(0.1, 0xffffff, 0, 0.3, -0.3);
  return k.build();
}
