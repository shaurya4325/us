// Renders each chibi once into a tiny transparent PNG for the HUD's left/right model badges.
import * as THREE from 'three';
import { Chibi } from './chibi';
import { PEOPLE, type Who } from '../config/people';

const cache: Partial<Record<Who, string>> = {};
export function portrait(who: Who): string {
  if (cache[who]) return cache[who]!;
  try {
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setSize(160, 160, false); r.outputColorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Scene(), c = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
    const ch = new Chibi(PEOPLE[who].look, '', PEOPLE[who].aura);
    ch.label.visible = false; ch.root.rotation.y = who === 'shaurya' ? 0.45 : -0.45; ch.update(0.016, false);
    s.add(ch.root); c.position.set(0, 1.1, 4.2); c.lookAt(0, 0.85, 0);
    r.render(s, c);
    cache[who] = r.domElement.toDataURL('image/png');
    ch.dispose(); r.dispose(); r.forceContextLoss();
  } catch { cache[who] = ''; }
  return cache[who]!;
}
