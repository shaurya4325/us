// Checks the bundled background-removal model runs from /imgly (no CDN).  node tools/test-cutout.mjs
import { launch, sleep } from './cdp.mjs';
const b = await launch();
const P = await b.page();
const urls = [];
await P.send('Network.enable');
P.send('Network.setCacheDisabled', { cacheDisabled: true });
const ws = P; // collect request URLs
const orig = ws.send;
await P.send('Page.navigate', { url: 'http://localhost:5199/download.html' });
await sleep(2500);
const t0 = Date.now();
const r = await P.eval(`(async()=>{
  const ents0 = performance.getEntriesByType('resource').length;
  const m = await import('/src/lib/media.ts');
  const blob = await (await fetch('/photos/arushi/arushi-happy-1.webp')).blob();
  const out = await m.makeCutout(blob, (p)=>{});
  const res = performance.getEntriesByType('resource').slice(ents0).map(e=>e.name);
  return JSON.stringify({ len: out.length, head: out.slice(0,22), cdn: res.filter(u=>!u.startsWith(location.origin)).slice(0,5), local: res.filter(u=>u.includes('/imgly/')).length });
})()`);
console.log(r, 'secs', (Date.now() - t0) / 1000, 'errors', P.errors.slice(0, 3));
b.close(); process.exit(0);
