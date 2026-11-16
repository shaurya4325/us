// By-eye + functional sweep of the expansion in solo-test mode (demo backend, headless, no desktop screenshots):
// every biome, every ruin, the HUD (hotbar, ⋯ inventory, tool wheel, emote fan), all five stations, the co-op
// mechanics (twin runes, two-key chest, giant node in rhythm, twin braziers, light-beam bridge, craft together),
// gift parcels, buffs and the new rooms. Writes screenshots + prints PASS/FAIL and draw-call counts.
//   npx vite --mode demo --port 5199   then   node tools/test-expansion.mjs <outDir>
import { launch, sleep } from './cdp.mjs';
import fs from 'node:fs';

const OUT = process.argv[2] || 'shots-exp'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5199/';
const ROOM = 'solo0000000000000000000000000042';
const WKEY = `us:d:us/${ROOM}/shared/world`;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
let n = 0; const shot = async (label) => A.shot(`${OUT}/${String(++n).padStart(2, '0')}-${label}.png`);

const b = await launch(844, 390);
const A = await b.page(BASE + '?solo&awake&debug');
await sleep(1500);
await A.eval(`localStorage.clear(); localStorage.setItem('us:session', JSON.stringify({ roomId: '${ROOM}', who: 'shaurya', deviceId: 'dev-s', v: 2 })); localStorage.setItem('vu:mute','1'); localStorage.setItem('vu:music','0'); location.reload(); 1`);
let ok = false;
for (let i = 0; i < 60 && !ok; i++) { await sleep(500); ok = await A.eval('typeof __us === "object" && !!__us && !!__us.cur'); }
check('Solo: world mounts with the bot partner', ok);
await sleep(2500);
const W = async () => JSON.parse(await A.eval(`localStorage.getItem('${WKEY}') || '{}'`));
const hud = async () => A.eval(`document.querySelector('.debug')?.textContent || ''`);
const tp = (x, z) => A.eval(`(()=>{ const e=__us; e.player.x=${x}; e.player.z=${z}; const g=e.cur.ground(${x},${z},40); e.player.y = g ?? e.player.y; e.vel.set(0,0); return g })()`);
await shot('spawn-prairie');
check('HUD: hotbar with ⋯ button', await A.eval(`!!document.querySelector('.hotbar .dots') && document.querySelectorAll('.hotbar .slot').length === 8`));
check('HUD: emote button on the left, old couple bar gone', await A.eval(`!!document.querySelector('.emote') && !document.querySelector('.couplebar')`));
console.log('   prairie:', await hud());

// test kit (every tool + materials)
await A.eval(`[...document.querySelectorAll('.solo-tag .pill')].find(b=>b.textContent.includes('Test kit'))?.click(); 1`); await sleep(800);
check('Test kit fills the shared vault', ((await W()).inv?.sakuraWood ?? 0) >= 100);

// tour the biomes (eye check + draw calls)
const spots = [['sakura', 55, 8], ['shrine', 62, 1], ['azure', -52, 0], ['treehouse', -62, 2], ['cliffs', 3, -50], ['meteor', 9, -46], ['lagoon', -3, 44], ['temple', -20, 20]];
for (const [name, x, z] of spots) {
  const g = await tp(x, z); await sleep(2200);
  const h = await hud(), draws = Number(/(\d+) draws/.exec(h)?.[1] ?? 0);
  check(`Biome ${name}: walkable + under 80 draw calls`, g !== null && draws > 0 && draws < 80, `${h} · ground ${g === null ? 'null' : g.toFixed(2)}`);
  await shot(`biome-${name}`);
}
check('Biome banner shows when entering a biome', await A.eval(`(async()=>{ const e=__us; e.player.x=0; e.player.z=4; await new Promise(r=>setTimeout(r,1200)); e.player.x=55; e.player.z=8; e.player.y=e.cur.ground(55,8,40); await new Promise(r=>setTimeout(r,1500)); return !!document.querySelector('.biome-banner') })()`));
await shot('biome-banner');

// HUD: emote fan, inventory, tool wheel
await tp(0.5, 5.4); await sleep(1500);
await A.eval(`document.querySelector('.emote').click(); 1`); await sleep(700);
check('Emote fan opens with 7 actions', await A.eval(`document.querySelectorAll('.emote-fan .emo').length`) === 7);
await shot('emote-fan');
await A.eval(`[...document.querySelectorAll('.emote-fan .emo')].find(b=>b.textContent.includes('Hug'))?.click(); 1`); await sleep(900);
check('Hug from the emote fan starts a moment', await A.eval(`!!document.querySelector('.moment')`));
await shot('hug-moment'); await sleep(2600);
await A.eval(`document.querySelector('.hotbar .dots').click(); 1`); await sleep(800);
check('⋯ opens the inventory (shared pouch)', await A.eval(`!!document.querySelector('.panel.inventory') && document.querySelectorAll('.inventory .slotgrid .slot').length >= 27`));
await shot('inventory');
await A.eval(`[...document.querySelectorAll('.inventory .tabs-row .pill')][1].click(); 1`); await sleep(400); await shot('inventory-tools');
await A.eval(`[...document.querySelectorAll('.inventory .tabs-row .pill')][0].click(); 1`); await sleep(300);
await A.eval(`[...document.querySelectorAll('.inventory .slotgrid .slot')].find(s=>s.title==='Sakura Lantern')?.click(); 1`); await sleep(300);
await A.eval(`[...document.querySelectorAll('.inventory .btn')].find(b=>b.textContent.includes('Hold'))?.click(); 1`); await sleep(700);
check('Hold a lantern from the inventory → action button says Place', (await A.eval(`document.querySelector('.ctxbtn').textContent`)).includes('Place'));
await A.eval(`__us.interact(); 1`); await sleep(700);
check('Place decor in the world', Object.values((await W()).decor ?? {}).some((d) => d && d.item === 'lantern'));
await shot('placed-lantern');
const sl = await A.eval(`JSON.stringify((()=>{ const r=document.querySelectorAll('.hotbar .slot')[1].getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2} })())`);
const { x: hx, y: hy } = JSON.parse(sl);
await A.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hx, y: hy, button: 'left', clickCount: 1 }); await sleep(650);
check('Hold a hotbar slot → radial tool wheel', await A.eval(`!!document.querySelector('.wheel')`));
await shot('tool-wheel');
await A.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hx, y: hy - 86, button: 'left', clickCount: 1 }); await sleep(500);

// stations
await A.eval(`__usPatch({ 'stations.furnace': 1, 'stations.anvil': 1, 'stations.loom': 1, 'stations.hearth': 1, 'stations.chest': 1 }, {})`); await sleep(600);
await tp(-4.5, -4); await sleep(1500); await shot('camp-stations');
for (const s of ['table', 'furnace', 'anvil', 'loom', 'hearth']) {
  await A.eval(`__us.ui('station','${s}'); 1`); await sleep(700);
  check(`Station ${s} opens`, await A.eval(`!!document.querySelector('.panel')`));
  await shot(`station-${s}`);
  if (s === 'table') { await A.eval(`[...document.querySelectorAll('.panel .tabs-row .pill')].find(p=>p.textContent==='Rooms').click(); 1`); await sleep(400); await shot('station-table-rooms'); }
  await A.eval(`document.querySelector('.drawer-bg')?.click(); 1`); await sleep(400);
}
// anvil upgrade through the UI
let w0 = await W();
await A.eval(`__us.ui('station','anvil'); 1`); await sleep(600);
await A.eval(`[...document.querySelectorAll('.anvil-row .btn')][0]?.click(); 1`); await sleep(600);
check('Anvil upgrades the hatchet a tier', ((await W()).tiers?.hatchet ?? 0) > (w0.tiers?.hatchet ?? 0));
await A.eval(`document.querySelector('.drawer-bg')?.click(); 1`); await sleep(400);
// craft together (the bot taps the heart in solo mode)
w0 = await W();
await A.eval(`__us.ui('station','table'); 1`); await sleep(600);
await A.eval(`[...document.querySelectorAll('.panel .tabs-row .pill')].find(p=>p.textContent==='Furniture').click(); 1`); await sleep(300);
await A.eval(`(async()=>{ const e=__us; e.pPos.set(e.player.x+1, e.player.y, e.player.z); return 1 })()`);
await A.eval(`document.querySelector('.together')?.removeAttribute('disabled'); document.querySelector('.together')?.click(); 1`); await sleep(400);
await shot('craft-together');
await A.eval(`document.querySelector('.ct-heart')?.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); 1`); await sleep(1600);
check('Craft Together engraves the item', Object.keys((await W()).engraved ?? {}).length > Object.keys(w0.engraved ?? {}).length);
await A.eval(`document.querySelector('.drawer-bg')?.click(); 1`); await sleep(500);
// quests board + keepsakes
await A.eval(`__us.ui('quests'); 1`); await sleep(600); check('Adventure board lists 3 quests', await A.eval(`document.querySelectorAll('.quest').length`) === 3); await shot('quests');
await A.eval(`document.querySelector('.drawer-bg')?.click(); 1`); await sleep(400);

// co-op: twin runes at the Cloud-Temple (the bot walks to the other rune)
const temple = JSON.parse(await A.eval(`JSON.stringify(__us.cur.ruins.defs.find(d=>d.id==='temple').runes)`));
await tp(temple[0][0], temple[0][1]); await sleep(5000);
check('Twin runes: standing on both unseals the temple', !!(await W()).ruins?.temple);
await sleep(800); await shot('temple-unsealed');
w0 = await W();
await A.eval(`(async()=>{ const e=__us, d=e.cur.ruins.defs.find(d=>d.id==='temple'); e.player.x=d.chest[0]+1.2; e.player.z=d.chest[1]; e.cur.interact('chest:temple', e); return 1 })()`); await sleep(1500);
check('Two-key chest opens (both keys within 3 s)', !!(await W()).chests?.temple && ((await W()).inv?.gem ?? 0) > (w0.inv?.gem ?? 0));
await A.eval(`__us.cur.interact('scroll:temple', __us); 1`); await sleep(500);
check('Blueprint scroll unlocks rooms', (await W()).bp?.living === true);
await A.eval(`__us.cur.interact('lore:temple:0', __us); 1`); await sleep(700); await shot('lore'); await A.eval(`document.querySelector('.drawer-bg')?.click(); 1`); await sleep(300);
// giant co-op node in rhythm
await tp(49.5, 12); await sleep(1500);
for (let i = 0; i < 11; i++) { await A.eval(`__us.cur.interact('gSakura', __us); 1`); await sleep(650); }
await sleep(1500);
const gs = (await W()).giants?.gSakura;
check('Giant Ancient Sakura falls to synced hits', (gs?.down ?? 0) > Date.now(), JSON.stringify(gs));
await shot('giant-sakura');
// twin braziers → Spirit-Bridge → Wind-Bell Sanctuary
await tp(1.8, -70.5); await sleep(3500);
await A.eval(`__us.cur.interact('brazier:0', __us); 1`); await sleep(1200);
check('Twin braziers raise the Spirit-Bridge', !!(await W()).bridges?.sky);
await sleep(600); await shot('spirit-bridge');
const okBridge = await A.eval(`__us.cur.ground(5, -77, 6) !== null`);
check('Spirit-Bridge is walkable over the gap', okBridge);
await tp(5, -84); await sleep(2000); await shot('wind-bell-sanctuary');
// light-beam: bot channels the anchor while you cross, then you pull the lever
await tp(-3, 45.5); await sleep(4500);
const beam = await A.eval(`__us.cur.ground(-3, 50.5, 1) !== null`);
check('Light-beam bridge holds while the partner channels', beam);
await shot('light-bridge');
await tp(-1.9, 56.6); await sleep(600);
await A.eval(`__us.cur.interact('lever', __us); 1`); await sleep(800);
check('Lever lowers the permanent wooden bridge', !!(await W()).bridges?.lagoon);
await sleep(600); await shot('grotto');
// gift + buff
await tp(0.5, 5.4); await sleep(2500);
await A.eval(`__us.gift('plushMochi'); 1`); await sleep(600); await shot('gift-parcel'); await sleep(1200);
check('Gift parcel lands in the partner gift box', ((await W()).giftbox?.arushi?.plushMochi ?? 0) >= 1);
await A.eval(`__us.eat('mochi'); 1`); await sleep(500);
check('Treat gives a buff', await A.eval(`[...document.querySelectorAll('.love .chip')].some(c=>c.textContent.includes('speed'))`));

// house with the new rooms
await A.eval(`__usPatch({ 'rooms.r1': { id: 'r1', type: 'bedroom', gx: 0, gz: 0, lv: 0, by: 'shaurya', at: 1 }, 'rooms.r2': { id: 'r2', type: 'living', gx: 0, gz: 1, lv: 0, by: 'shaurya', at: 2 }, 'rooms.r3': { id: 'r3', type: 'music', gx: 1, gz: 1, lv: 0, by: 'shaurya', at: 3 }, 'rooms.r4': { id: 'r4', type: 'kitchen', gx: -1, gz: 1, lv: 0, by: 'shaurya', at: 4 } }, {})`); await sleep(800);
await tp(5.5, 2.5); await sleep(1200); await shot('house-exterior');
await A.eval(`__us.enter(); 1`); await sleep(2600);
check('Enter the house (overworld unloaded)', await A.eval(`__us.sceneKind()`) === 'inside');
console.log('   inside:', await hud());
await shot('interior');
await A.eval(`(()=>{ const e=__us; e.player.x=0; e.player.z=13; e.player.y=0; return 1 })()`); await sleep(1200); await shot('interior-living');
await A.eval(`(()=>{ const e=__us; e.player.x=12; e.player.z=12; e.player.y=0; return 1 })()`); await sleep(1200); await shot('interior-music');
await A.eval(`__us.ui('paint','r2'); 1`); await sleep(600); await shot('paint'); await A.eval(`document.querySelectorAll('.swatch')[7]?.click(); 1`); await sleep(600);
check('Paintbrush recolours a room', !!(await W()).paint?.r2?.wall);
await A.eval(`document.querySelector('.drawer-bg')?.click(); 1`); await sleep(400);
await A.eval(`__us.exit(); 1`); await sleep(2200);
check('Exit back to the archipelago', await A.eval(`__us.sceneKind()`) === 'over');

const errs = A.errors.filter((e) => !/favicon|DevTools|WebGL|GPU stall|swiftshader/i.test(String(e)));
check('No JavaScript errors', errs.length === 0, errs.slice(0, 4).join(' | '));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
b.close(); process.exit(0);
