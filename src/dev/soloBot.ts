// Solo test mode (local demo only): open http://localhost:5199/?solo
// A bot stands in for your partner: it is "online" (so the world opens), follows you around the meadow and into
// the house, and mirrors your hugs/kisses/dances. It never runs in the real app: that has Firebase, so it is ignored.
import { getStatus, setDoc } from '../lib/sync';
import type { Who } from '../config/people';

export const SOLO = new URLSearchParams(location.search).has('solo') && getStatus() === 'demo';

interface EngineLike { player: { x: number; y: number; z: number }; sceneKind(): string; myAnim(): string; groundAt(x: number, z: number, y: number): number | null }
let eng: EngineLike | null = null;
export const setSoloEngine = (e: EngineLike | null) => { eng = e; };

const MIRROR = ['hug', 'kiss', 'dance', 'hands', 'sit', 'swim', 'wave', 'pat'];

export function startSoloBot(base: string, partner: Who) {
  const since = Date.now();
  let x = partner === 'shaurya' ? -0.7 : 0.7, z = 6, y = 0.5, yaw = 0, scene = 'over', t = 0;
  const beat = () => setDoc(`${base}/state/${partner}`, { online: true, lastSeen: Date.now(), since, mood: 'happy' });
  beat();
  const hb = setInterval(beat, 3000);
  const mv = setInterval(() => {
    t += 0.15;
    let anim = 'idle';
    if (eng) {
      const P = eng.player, k = eng.sceneKind();
      if (k !== scene) { scene = k; x = P.x + 1.2; z = P.z + 0.4; }          // came through the door with you
      const tx = P.x + 1.3, tz = P.z + 0.5, dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz);
      if (d > 8) { x = tx; z = tz; }
      else if (d > 0.3) { const step = Math.min(d, 4.2 * 0.15); x += (dx / d) * step; z += (dz / d) * step; yaw = Math.atan2(dx, dz); anim = 'walk'; }
      if (anim === 'idle') yaw = Math.atan2(P.x - x, P.z - z);                 // look at you
      const mine = eng.myAnim();
      if (MIRROR.includes(mine)) anim = mine === 'pat' ? 'idle' : mine;
      else if (anim === 'idle' && Math.sin(t * 0.4) > 0.97) anim = 'wave';     // the occasional wave
      y = eng.groundAt(x, z, P.y + 1) ?? P.y;
    }
    setDoc(`${base}/live/${partner}`, { snap: { p: [x, y, z], r: yaw, a: anim, tl: 'none', s: scene, v: 0, t: Date.now() } });
  }, 150);
  return () => { clearInterval(hb); clearInterval(mv); setDoc(`${base}/state/${partner}`, { online: false, lastSeen: Date.now() }); };
}
