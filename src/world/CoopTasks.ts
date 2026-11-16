// Mandatory two-player mechanics, decided the same way on both phones so nothing is ever granted twice:
//  • two-key actions (treasure chests, twin braziers, the lagoon lever): both press within 3 s of each other
//  • giant co-op nodes: a hit only counts when the partner also hit the same node within 1.6 s (chop in rhythm)
// The phone whose press came LATER completes the pair (ties go to Shaurya). Both phones see the same two
// timestamps, so exactly one of them acts.
import type { Who } from '../config/people';

export const KEY_WINDOW = 3000, HIT_WINDOW = 1600;
type Send = (k: string, d: any) => void;

export class CoopTasks {
  private myKey = new Map<string, number>(); private pKey = new Map<string, number>();
  private myHit = new Map<string, number>(); private pHit = new Map<string, number>();
  private used = new Set<string>(); private hitUsed = new Set<number>();
  onKeyDone: (id: string) => void = () => {};
  onHitSynced: (id: string) => void = () => {};
  onPartnerKey: (id: string) => void = () => {};

  constructor(private me: Who, private send: Send, private solo: boolean) {}

  private later(mine: number, theirs: number) { return mine > theirs || (mine === theirs && this.me === 'shaurya'); }

  /** my half of a two-key action */
  key(id: string) {
    const T = Date.now();
    this.myKey.set(id, T); this.send('key', { id, T });
    const p = this.pKey.get(id);
    if (p && Math.abs(T - p) < KEY_WINDOW && this.later(T, p) && this.claim(`k:${id}:${p}:${T}`)) this.onKeyDone(id);
    if (this.solo) setTimeout(() => this.partner('key', { id, T: Date.now() }), 450);   // the solo-test bot turns its key too
  }
  hit(id: string) {
    const T = Date.now();
    this.myHit.set(id, T); this.send('hit', { id, T });
    const p = this.pHit.get(id);
    if (p && !this.hitUsed.has(p) && Math.abs(T - p) < HIT_WINDOW && this.later(T, p) && this.claim(`h:${id}:${p}:${T}`)) { this.hitUsed.add(p).add(T); this.onHitSynced(id); }
    if (this.solo) setTimeout(() => this.partner('hit', { id, T: Date.now() }), 380);
  }
  /** a partner key/hit arrived */
  partner(k: string, d: { id: string; T: number }) {
    if (k === 'key') {
      this.pKey.set(d.id, d.T); this.onPartnerKey(d.id);
      const m = this.myKey.get(d.id);
      if (m && Math.abs(m - d.T) < KEY_WINDOW && (this.solo || this.later(m, d.T)) && this.claim(`k:${d.id}:${d.T}:${m}`)) this.onKeyDone(d.id);
    } else if (k === 'hit') {
      this.pHit.set(d.id, d.T);
      const m = this.myHit.get(d.id);
      if (m && !this.hitUsed.has(m) && Math.abs(m - d.T) < HIT_WINDOW && (this.solo || this.later(m, d.T)) && this.claim(`h:${d.id}:${d.T}:${m}`)) { this.hitUsed.add(m).add(d.T); this.onHitSynced(d.id); }
    }
  }
  private claim(k: string) { if (this.used.has(k)) return false; this.used.add(k); return true; }

  /** UI hint: "waiting for your partner" countdown (ms left) for my latest key press, or 0 */
  waiting(id: string) { const m = this.myKey.get(id); return m ? Math.max(0, KEY_WINDOW - (Date.now() - m)) : 0; }
  partnerWaiting(id: string) { const p = this.pKey.get(id); return p ? Math.max(0, KEY_WINDOW - (Date.now() - p)) : 0; }
  partnerHitRecently(id: string) { const p = this.pHit.get(id); return !!p && Date.now() - p < HIT_WINDOW; }
}
