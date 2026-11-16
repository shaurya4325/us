// End-to-end co-op check: gate lock → both online → countdown → world → build → interior → love actions → disconnect.
//   (start `npx vite --mode demo --port 5199` first)  node tools/test-coop.mjs <outDir>
import { launch, sleep } from './cdp.mjs';
import fs from 'node:fs';

const OUT = process.argv[2] || 'shots'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5199/';
const b = await launch();
const sess = (who) => `localStorage.setItem('us:session', JSON.stringify({ roomId: 'test0000000000000000000000000001', who: '${who}', deviceId: '${who}-dev', v: 2 })); localStorage.setItem('vu:mute','1'); 1`;
const A = await b.page(BASE + '?awake');
await sleep(1500); await A.eval(sess('arushi')); await A.eval('localStorage.clear(); ' + sess('arushi'));
await A.send('Page.reload'); await sleep(3500);
await A.shot(`${OUT}/01-gate-arushi-alone.png`);
console.log('A world mounted while alone?', await A.eval('!!document.querySelector(".world")'));

const B = await b.page(BASE + '?as=shaurya&awake');
await sleep(2500);
await B.shot(`${OUT}/02-countdown-shaurya.png`);
for (let i = 0; i < 40; i++) { if (await A.eval('typeof __usPatch === "function"') && await B.eval('typeof __usPatch === "function"')) break; await sleep(500); }
await sleep(1500);
console.log('A world:', await A.eval('!!document.querySelector(".world canvas")'), 'B world:', await B.eval('!!document.querySelector(".world canvas")'));
await A.shot(`${OUT}/03-world-arushi.png`);
await B.shot(`${OUT}/04-world-shaurya.png`);

// gather + build: give resources, craft tools, build bedroom, then right wing + upper floor
await A.eval(`__usPatch({}, { 'inv.wood': 80, 'inv.stone': 60, 'inv.crystal': 20, 'inv.flower': 20, 'inv.fish': 6, 'inv.bug': 6 })`);
await sleep(600);
await A.eval(`__usPatch({ 'tools.hatchet': true, 'tools.pickaxe': true, 'tools.can': true, 'tools.net': true, 'tools.rod': true, 'pets.pup': { owner: 'arushi', at: Date.now() }, 'pets.kitten': { owner: 'shaurya', at: Date.now() } })`);
// walk A toward the east grove and chop
await A.eval(`(async()=>{ const e=__us; e.player.x=9.2; e.player.z=4.5; await new Promise(r=>setTimeout(r,300)); return JSON.stringify(e.ctx) })()`).then((r) => console.log('ctx near grove:', r));
await A.eval(`(async()=>{ for(let i=0;i<4;i++){ __us.interact(); await new Promise(r=>setTimeout(r,450)); } return 1 })()`);
await sleep(400);
await A.shot(`${OUT}/05-chop.png`);
console.log('inv after chop:', await A.eval(`JSON.stringify(JSON.parse(localStorage.getItem('us:d:us/test0000000000000000000000000001/shared/world')).inv)`));
await A.eval(`__usPatch({ 'rooms.r1': { id:'r1', type:'bedroom', gx:0, gz:0, lv:0, by:'arushi', at:1 }, 'rooms.r2': { id:'r2', type:'kitchen', gx:1, gz:0, lv:0, by:'arushi', at:2 }, 'rooms.r3': { id:'r3', type:'rooftop', gx:0, gz:0, lv:1, by:'shaurya', at:3 }, 'rooms.r4': { id:'r4', type:'pool', gx:0, gz:-1, lv:0, by:'shaurya', at:4 } })`);
await sleep(800);
// move both next to the house
await A.eval(`__us.player.x=4.2; __us.player.z=0.5; 1`); await B.eval(`__us.player.x=5.0; __us.player.z=0.8; 1`);
await sleep(2500);
await A.shot(`${OUT}/06-house-exterior.png`);
await sleep(4500);
await A.shot(`${OUT}/07-full-love.png`);
await A.eval(`document.querySelector('.emote').click(); 1`); await sleep(500);
console.log('A emote actions enabled:', await A.eval('document.querySelectorAll(".emote-fan .emo:not(.off)").length'));
await A.eval(`document.querySelectorAll('.emote-fan .emo')[0].click(); 1`);
await sleep(700);
await B.shot(`${OUT}/08-kiss-seen-by-shaurya.png`);
// enter the house (black fade, overworld disposed)
await A.eval(`__us.enter(); 1`); await sleep(1500);
await A.shot(`${OUT}/09-interior.png`);
console.log('A scene:', await A.eval('__us.cur.kind'));
// walk to kitchen through the hallway (no fade) + climb the stairs
await A.eval(`(async()=>{ const e=__us; e.player.x=4.5; e.player.z=0; await new Promise(r=>setTimeout(r,200)); for(let i=0;i<30;i++){ e.keys.add('d'); await new Promise(r=>setTimeout(r,50)); } e.keys.clear(); return [e.player.x.toFixed(1), e.player.z.toFixed(1), e.cur.kind].join() })()`).then((r) => console.log('walked:', r));
await sleep(800);
await A.shot(`${OUT}/10-kitchen-hallway.png`);
await A.eval(`(async()=>{ const e=__us; e.player.x=-1.6; e.player.z=-3.7; e.player.y=0; await new Promise(r=>setTimeout(r,100)); e.setJoy(-1,0); await new Promise(r=>setTimeout(r,1400)); e.setJoy(0,0); return e.player.y.toFixed(2) })()`).then((r) => console.log('after stairs y:', r));
await sleep(800);
await A.shot(`${OUT}/11-upper-floor.png`);
for (const [n, p] of [['A', A], ['B', B]]) console.log(n, 'errors:', p.errors.slice(0, 8), 'hud:', await p.eval('document.querySelector(".debug")?.textContent'));
// disconnect: B leaves → A back at gate
await B.close(); await sleep(24000);
await A.shot(`${OUT}/12-partner-left.png`);
console.log('A world after B left:', await A.eval('!!document.querySelector(".world")'));
b.close();
process.exit(0);
