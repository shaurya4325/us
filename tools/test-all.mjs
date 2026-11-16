// Full feature sweep as two phones (demo mode). Prints a PASS/FAIL table and writes screenshots.
//   npx vite --mode demo --port 5199   then   node tools/test-all.mjs <outDir>
import { launch, sleep } from './cdp.mjs';
import fs from 'node:fs';

const OUT = process.argv[2] || 'shots'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5199/';
const ROOM = 'test0000000000000000000000000009';
const WKEY = `us:d:us/${ROOM}/shared/world`;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
let n = 0; const shot = async (p, label) => p.shot(`${OUT}/${String(++n).padStart(2, '0')}-${label}.png`);

const b = await launch();
const A = await b.page(BASE + '?awake');
await sleep(1500);
await A.eval(`localStorage.clear(); localStorage.setItem('us:session', JSON.stringify({ roomId: '${ROOM}', who: 'arushi', deviceId: 'arushi-dev', v: 2 })); localStorage.setItem('vu:mute','1'); location.reload(); 1`);
await sleep(3500);
check('Gate: world stays unmounted while alone', !(await A.eval('!!document.querySelector(".world")')) && await A.eval('!!document.querySelector(".gate")'));
await shot(A, 'gate');

const B = await b.page(BASE + '?as=shaurya&awake');
let mounted = false;
for (let i = 0; i < 40 && !mounted; i++) { await sleep(500); mounted = await A.eval('typeof __usPatch === "function"') && await B.eval('typeof __usPatch === "function"'); }
check('Both online → countdown → both worlds mount', mounted);
await sleep(1200);
await shot(B, 'world-shaurya');
const W = async () => JSON.parse(await A.eval(`localStorage.getItem('${WKEY}') || '{}'`));

// ---------- gathering with the real interact paths ----------
await A.eval(`__usPatch({ 'tools.hatchet': true, 'tools.pickaxe': true }, { 'inv.wood': 0 })`);
const gather = async (id, times, gap = 450) => A.eval(`(async()=>{ const e=__us, n=e.cur.nodes.find(x=>x.id==='${id}'); e.player.x=n.x+1.1; e.player.z=n.z; e.player.y=n.y; for(let i=0;i<${times};i++){ e.cur.interact('${id}', e); await new Promise(r=>setTimeout(r,${gap})); } return 1 })()`);
let w0 = await W(); await gather('b0', 2); let w1 = await W();
check('Chop birch with hatchet → wood', (w1.inv?.wood ?? 0) > (w0.inv?.wood ?? 0), `${w0.inv?.wood ?? 0} → ${w1.inv?.wood}`);
check('Felled tree goes on respawn timer', (w1.nodes?.b0 ?? 0) > Date.now());
await shot(A, 'chopped');
w0 = w1; await gather('r0', 2); w1 = await W(); check('Mine rock → stone', (w1.inv?.stone ?? 0) > (w0.inv?.stone ?? 0), `${w0.inv?.stone ?? 0} → ${w1.inv?.stone}`);
w0 = w1; await gather('x0', 2); w1 = await W(); check('Mine rose-crystal → crystal', (w1.inv?.crystal ?? 0) > (w0.inv?.crystal ?? 0));
w0 = w1; await gather('f0', 1); w1 = await W(); check('Pick flowers → flower', (w1.inv?.flower ?? 0) > (w0.inv?.flower ?? 0));
// crafting through the bench panel UI
await A.eval(`__usPatch({}, { 'inv.wood': 60, 'inv.stone': 40, 'inv.flower': 30, 'inv.bug': 5 })`); await sleep(300);
await A.eval(`__us.ui('craft'); 1`); await sleep(600);
await A.eval(`[...document.querySelectorAll('.panel .opt')].filter(o=>!o.disabled).forEach(o=>o.click()); 1`); await sleep(600);
w1 = await W(); check('Craft can/net/rod at the bench', w1.tools?.can && w1.tools?.net && w1.tools?.rod, JSON.stringify(w1.tools));
await shot(A, 'craft-panel');
await A.eval(`document.querySelector('.drawer-bg')?.click(); 1`); await sleep(400);
// net + rod (random outcomes, so retry)
for (let i = 0; i < 5 && !((await W()).stats?.bug); i++) { await A.eval(`(async()=>{ const e=__us, i=e.cur.bugs.findIndex(b=>b.gone<Date.now()); e.cur.interact('bug'+i, e); return 1 })()`); await sleep(400); }
check('Butterfly net catches a butterfly', ((await W()).stats?.bug ?? 0) >= 1, `caught ${(await W()).stats?.bug ?? 0}`);
let fish = 0; for (let i = 0; i < 5 && !fish; i++) { await A.eval(`(async()=>{ const e=__us; e.player.x=-6; e.player.z=9.2; e.cur.interact('fish', e); return 1 })()`); await sleep(1900); fish = (await W()).inv?.fish ?? 0; }
check('Fishing rod catches koi', fish > 0, `fish ${fish}`);
// planting with the watering can
await A.eval(`(async()=>{ const e=__us; e.player.x=-2; e.player.z=12; e.player.y=e.cur.ground(-2,12,5); await new Promise(r=>setTimeout(r,200)); e.ctx={id:'plant',x:-2,z:12,r:1,label:'',icon:''}; e.interact(); return 1 })()`); await sleep(500);
check('Plant a sapling', Object.keys((await W()).planted ?? {}).length > 0);
// sky-cables + pets via their panels/anchors
await A.eval(`__usPatch({}, { 'inv.wood': 300, 'inv.stone': 300, 'inv.crystal': 60, 'inv.flower': 40, 'inv.fish': 20, 'inv.bug': 20 })`); await sleep(300);
await A.eval(`['west','east','quarry'].forEach(a=>__us.cur.interact('anchor:'+a, __us)); 1`); await sleep(500);
check('Build all 3 Sky-Cables', Object.keys((await W()).cables ?? {}).length === 3);
await A.eval(`__us.ui('pets'); 1`); await sleep(500);
await A.eval(`[...document.querySelectorAll('.panel .opt')].find(o=>!o.disabled)?.click(); 1`); await sleep(500);
check('Adopt a pet at the nest', Object.keys((await W()).pets ?? {}).length >= 1);
await B.eval(`__usPatch({ 'pets.kitten': { owner: 'shaurya', at: Date.now() }, 'pets.panda': { owner: 'shaurya', at: Date.now() } })`); await sleep(500);

// ---------- house: first room + one expansion through the build panel UI, the rest by patch ----------
await A.eval(`__us.ui('build'); 1`); await sleep(500);
await A.eval(`[...document.querySelectorAll('.panel .opt')].find(o=>o.textContent.includes('Bedroom'))?.click(); 1`); await sleep(600);
check('Build first room (bedroom) via panel', Object.values((await W()).rooms ?? {}).some((r) => r.type === 'bedroom'));
await A.eval(`__us.ui('build'); 1`); await sleep(500);
await A.eval(`[...document.querySelectorAll('.panel .pill')].find(p=>p.textContent.includes('Right wing'))?.click(); 1`); await sleep(200);
await shot(A, 'build-panel');
await A.eval(`[...document.querySelectorAll('.panel .opt')].find(o=>o.textContent.includes('Kitchen'))?.click(); 1`); await sleep(600);
const k = Object.values((await W()).rooms ?? {}).find((r) => r.type === 'kitchen');
check('Expand: kitchen on the right wing via panel', k && k.gx === 1 && k.gz === 0 && k.lv === 0, JSON.stringify(k));
const rest = { greenhouse: [-1, 0, 0], pool: [0, -1, 0], cinema: [1, -1, 0], observatory: [-1, -1, 0], cuddle: [0, 1, 0], nursery: [1, 1, 0], gallery: [-1, 1, 0], rooftop: [0, 0, 1] };
await A.eval(`__usPatch(${JSON.stringify(Object.fromEntries(Object.entries(rest).map(([t, [gx, gz, lv]], i) => [`rooms.t${i}`, { id: `t${i}`, type: t, gx, gz, lv, by: 'arushi', at: i }])))})`);
await sleep(800);
check('All 10 room types built', Object.keys((await W()).rooms ?? {}).length === 10);
await A.eval(`(async()=>{ const e=__us; e.player.x=3; e.player.z=5.5; e.player.y=e.cur.ground(3,5.5,5); return 1 })()`); await B.eval(`(async()=>{ const e=__us; e.player.x=12; e.player.z=4; e.player.y=e.cur.ground(12,4,5); return 1 })()`);
await sleep(2500);
await shot(A, 'house-10-rooms');

// ---------- panels from the world ----------
for (const [id, data, want] of [['cook', null, 'Kitchen'], ['outfit', null, 'Wardrobe'], ['petcare', 'bowls', 'Treat'], ['wish', 'jar', 'Wish Jar'], ['music', null, 'Vinyl'], ['piano', null, 'Music Studio'], ['trophy', null, 'Milestones']]) {
  await A.eval(`__us.ui('${id}', ${JSON.stringify(data)}); 1`); await sleep(500);
  const h = await A.eval(`document.querySelector('.panel h2')?.textContent || ''`);
  check(`Panel "${id}" opens`, h.includes(want), h);
  if (id === 'cook') {
    await A.eval(`document.querySelector('.panel .opt').click(); 1`); await sleep(300);
    for (let i = 0; i < 3; i++) { await A.eval(`[...document.querySelectorAll('.panel button')].find(b=>b.textContent.includes('Now'))?.click(); 1`); await sleep(350); }
    await shot(A, 'cook-done');
    check('Cooking mini-game finishes and saves the dish', Object.keys((await W()).dishes ?? {}).length > 0);
  }
  if (id === 'outfit') { await A.eval(`document.querySelectorAll('.panel .opt')[3].click(); 1`); await sleep(300); check('Wardrobe changes cape (synced)', (await W()).capes?.arushi === 3); }
  if (id === 'wish') {
    await A.eval(`(()=>{const el=document.querySelector('.panel input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'a picnic by the pond'); el.dispatchEvent(new Event('input',{bubbles:true})); return 1})()`); await sleep(100);
    await A.eval(`[...document.querySelectorAll('.panel button')].find(b=>b.textContent==='Add').click(); 1`); await sleep(300);
    check('Wish saved', Object.values((await W()).wishes ?? {}).some((x) => x.text === 'a picnic by the pond'));
  }
  if (id === 'trophy') await shot(A, 'trophy');
  await A.eval(`document.querySelector('.drawer-bg')?.click(); 1`); await sleep(350);
}
await A.eval(`__us.ui('stars'); 1`); await sleep(2500); await shot(A, 'stargaze');
await A.eval(`document.querySelector('.night').click(); 1`); await sleep(300); await A.eval(`document.querySelector('.night')?.click(); 1`); await sleep(600);
check('Stargazing overlay opens and closes', !(await A.eval('!!document.querySelector(".night")')));
await A.eval(`__us.ui('movie'); 1`); await sleep(1500); await shot(A, 'movie');
await A.eval(`document.querySelector('.movie').click(); 1`); await sleep(3000);
check('Movie night overlay opens and closes', !(await A.eval('!!document.querySelector(".movie")')));

// ---------- love meter + couple actions ----------
await A.send('Page.bringToFront');
await A.eval(`(()=>{const e=__us; e.player.x=2; e.player.z=7; e.player.y=e.cur.ground(2,7,5); return 1})()`);
await B.eval(`(()=>{const e=__us; e.player.x=2.8; e.player.z=7; e.player.y=e.cur.ground(2.8,7,5); return 1})()`);
let btns = 0; for (let i = 0; i < 50 && btns < 6; i++) { await sleep(500); btns = await A.eval('document.querySelectorAll(".couple button").length'); }
check('Love meter fills → 6 couple buttons', btns === 6, `${btns} buttons`);
for (const kind of ['Kiss', 'Hug', 'Dance', 'Head Pat', 'Whisper']) { await A.eval(`[...document.querySelectorAll('.couple button')].find(b=>b.textContent.includes('${kind}'))?.click(); 1`); await sleep(kind === 'Kiss' ? 500 : 1200); if (kind === 'Kiss') await shot(B, 'kiss-on-shaurya'); }
await sleep(600);
const st = (await W()).stats ?? {};
check('Kiss/hug/dance counted', st.kiss >= 1 && st.hug >= 1 && st.dance >= 1, JSON.stringify(st));
check('Whisper bubble appears on partner screen', await B.eval('document.querySelectorAll(".bubble").length') > 0);
await A.eval(`[...document.querySelectorAll('.couple button')].find(b=>b.textContent.includes('Hold'))?.click(); 1`); await sleep(600);
check('Hold hands toggles on both phones', await A.eval('__us.holding') === 'arushi' && await B.eval('__us.holding') === 'arushi');
await A.eval(`[...document.querySelectorAll('.couple button')].find(b=>b.textContent.includes('Let go'))?.click(); 1`); await sleep(400);

// ---------- interior: black fade, unified house, every object ----------
await A.eval(`__us.enter(); 1`); await B.eval(`__us.enter(); 1`); await sleep(1500);
check('Door: overworld unloaded, interior loaded', await A.eval('__us.cur.kind') === 'inside' && await A.eval('__us.cur.constructor.name') === 'Interior');
const rooms = JSON.parse(await A.eval(`JSON.stringify(__us.cur.rooms.map(r=>({id:r.c.id,type:r.c.type,ox:r.ox,oy:r.oy,oz:r.oz})))`));
for (const r of rooms) {
  await A.eval(`(()=>{const e=__us; e.player.x=${r.ox}+0.5; e.player.z=${r.oz}+2.2; e.player.y=${r.oy}; e.vy=0; return 1})()`);
  const shoot = ['bedroom', 'kitchen', 'pool', 'cinema', 'cuddle', 'gallery', 'observatory', 'rooftop'].includes(r.type);
  await sleep(shoot ? 1300 : 250);
  if (shoot) await shot(A, 'room-' + r.type);
}
const spots = JSON.parse(await A.eval(`JSON.stringify(__us.cur.interactables().map(i=>({id:i.id,x:i.x,z:i.z,y:i.y??0})))`));
let opened = 0, errs0 = A.errors.length;
for (const s of spots.filter((x) => x.id !== 'exit')) {
  await A.eval(`(()=>{const e=__us; e.player.x=${s.x}; e.player.z=${s.z}; e.player.y=${s.y}; e.cur.interact('${s.id}', e); return 1})()`); await sleep(350);
  // a response = a panel/overlay/drawer, a toast, a new event to the partner, or the character playing an action
  const any = await A.eval(`!!(document.querySelector('.panel')||document.querySelector('.night')||document.querySelector('.movie')||document.querySelector('.drawer')||document.querySelector('.toast')||__us.animUntil>performance.now())`);
  if (any) opened++; else console.log('   no visible response:', s.id);
  await A.eval(`document.querySelector('.drawer-bg')?.click(); document.querySelector('.night')?.click(); document.querySelector('.night')?.click(); document.querySelector('.movie')?.click(); 1`); await sleep(250);
}
check(`All ${spots.length - 1} interior objects respond`, opened === spots.length - 1 && A.errors.length === errs0, `${opened} responded, ${A.errors.length - errs0} errors`);
const bed = rooms.find((r) => r.type === 'bedroom'), pool = rooms.find((r) => r.type === 'pool');
const climb = await A.eval(`(async()=>{ const e=__us; e.player.x=${bed.ox}-1.6; e.player.z=${bed.oz}-3.7; e.player.y=0; e.vy=0; await new Promise(r=>setTimeout(r,100)); e.setJoy(-1,0); await new Promise(r=>setTimeout(r,1400)); e.setJoy(0,0); return e.player.y.toFixed(2) })()`);
check('Stairs lead to the upper floor', Number(climb) > 3, `y=${climb}`);
const hall = await A.eval(`(async()=>{ const e=__us; e.player.x=${bed.ox}+3.5; e.player.z=${bed.oz}; e.player.y=0; await new Promise(r=>setTimeout(r,100)); e.setJoy(1,1); await new Promise(r=>setTimeout(r,2200)); e.setJoy(0,0); return [e.player.x.toFixed(1), e.cur.kind].join() })()`);
check('Walk through a hallway into the next room with no fade', Number(hall.split(',')[0]) > bed.ox + 7 && hall.endsWith('inside'), hall);
const swim = await A.eval(`(async()=>{ const e=__us; e.player.x=${pool.ox}+1; e.player.z=${pool.oz}+0.5; e.player.y=0; await new Promise(r=>setTimeout(r,400)); return e.mine.anim })()`);
check('Walking into the pool swims', swim === 'swim', swim);
await sleep(300); await shot(A, 'swimming');
const draws = await A.eval('__us.renderer.info.render.calls');
check('Interior with 10 rooms stays under 75 draw calls', draws < 75, `${draws} draws`);
await A.eval(`__us.exit(); 1`); await sleep(1500);
check('Exit door → back to the meadow', await A.eval('__us.cur.kind') === 'over');
const odraws = await A.eval('__us.renderer.info.render.calls');
check('Overworld stays under 75 draw calls', odraws < 75, `${odraws} draws`);

// ---------- 2D drawers, mood, poke, settings, studio ----------
for (const t of ['Us Checkup & Open Heart', 'The Velvet Arcade', 'Cuddle Corner', 'Sunday Safe Space', 'Until We Marry']) {
  await A.eval(`document.querySelector('.dock button[title="${t}"]').click(); 1`); await sleep(700);
  const ok = await A.eval('!!document.querySelector(".drawer")');
  check(`Drawer "${t}" opens over the world`, ok);
  if (t === 'Cuddle Corner') await shot(A, 'drawer-cuddle');
  await A.eval(`document.querySelector('.drawer-bg')?.click(); 1`); await sleep(500);
}
await B.send('Page.bringToFront');   // headless Chrome stalls the window that isn't in front; let it catch up first
for (let i = 0; i < 40; i++) {
  const latest = await B.eval(`(JSON.parse(localStorage.getItem('us:c:us/${ROOM}/events')||'[]').find(e=>e.to==='shaurya')||{}).at||0`);
  const seen = Number(await B.eval(`localStorage.getItem('vu:seen:${ROOM}:shaurya')||0`));
  if (seen >= latest) { console.log(`   (B caught up after ${i * 0.5}s)`); break; }
  await sleep(500);
}
await sleep(1000);
await A.eval(`document.querySelector('.moodbtn[title="Sad / Bothered"]').click(); 1`);
let bt = ''; for (let i = 0; i < 8 && !bt.includes('Arushi is feeling'); i++) { await sleep(500); bt = await B.eval(`[...document.querySelectorAll('.toast')].map(t=>t.textContent).join(' | ')`); }
check('Mood change reaches partner (toast)', bt.includes('Arushi is feeling'), bt.slice(0, 160));
await A.send('Page.bringToFront'); await sleep(800);
await B.eval(`document.querySelector('.stage').click(); 1`);
let at = ''; for (let i = 0; i < 20 && !at.includes('poked you'); i++) { await sleep(500); at = await A.eval(`[...document.querySelectorAll('.toast')].map(t=>t.textContent).join(' | ')`); }
check('Poke reaches partner', at.includes('poked you'), at.slice(0, 160));
await B.eval(`document.querySelector('.dock button[title="Creator Update Studio"]').click(); 1`); await sleep(600);
check('Creator Studio opens for Shaurya', await B.eval(`document.querySelector('.sheet h2')?.textContent.includes('Creator Update Studio')`));
await B.eval(`document.querySelector('.sheet-bg').click(); 1`); await sleep(300);
check('No Creator Studio button for Arushi', !(await A.eval(`!!document.querySelector('.dock button[title="Creator Update Studio"]')`)));
await A.eval(`document.querySelector('.dock button[title="Settings"]').click(); 1`); await sleep(500); await shot(A, 'settings');
await A.eval(`document.querySelector('.sheet-bg').click(); 1`); await sleep(300);
const hud = await A.eval('document.querySelector(".debug")?.textContent');
check('No JS errors on either phone', !A.errors.length && !B.errors.length, [...A.errors, ...B.errors].slice(0, 3).join(' | '));

// ---------- partner leaves ----------
await B.close();
let back = false; for (let i = 0; i < 30 && !back; i++) { await sleep(1000); back = !(await A.eval('!!document.querySelector(".world")')); }
check('Partner closes app → back to the gate', back);
await shot(A, 'partner-left');
console.log('\nHUD:', hud);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
b.close(); process.exit(0);
