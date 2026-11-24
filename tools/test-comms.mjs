// Chat + voice sweep as two phones (demo mode, Chrome's fake microphone). Checks that text arrives as chat + bubble,
// that always-on voice really streams audio to the partner, that push-to-talk only transmits while held, and that
// push-to-talk falls back to walkie-talkie clips when there's no direct link.
//   npx vite --mode demo --port 5199   then   node tools/test-comms.mjs <outDir>
import { launch, sleep } from './cdp.mjs';
import fs from 'node:fs';

const OUT = process.argv[2] || 'shots-comms'; fs.mkdirSync(OUT, { recursive: true });
const ROOM = 'comm0000000000000000000000000011';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sess = (w) => `localStorage.setItem('us:session', JSON.stringify({ roomId: '${ROOM}', who: '${w}', deviceId: '${w}-d', v: 2 })); localStorage.setItem('vu:mute','1'); localStorage.setItem('vu:music','0'); localStorage.removeItem('us:voice');`;

const b = await launch(844, 390);
const A = await b.page('http://localhost:5199/?awake'); await sleep(3000);
await A.eval(`localStorage.clear(); ${sess('arushi')} location.reload(); 1`); await sleep(3000);
const B = await b.page('http://localhost:5199/?as=shaurya&awake');
let up = false; for (let i = 0; i < 60 && !up; i++) { await sleep(500); up = await A.eval('!!window.__us?.cur && !!window.__voice') && await B.eval('!!window.__us?.cur && !!window.__voice'); }
check('Both in the world, comms mounted', up && await A.eval(`!!document.querySelector('.comms .cbtn')`));
const front = async (p) => { await p.send('Page.bringToFront'); await sleep(150); };
const setVal = (p, sel, v) => p.eval(`(()=>{const el=document.querySelector('${sel}'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input',{bubbles:true})); return 1})()`);
// stand together so bubbles are on screen
await A.eval(`(()=>{const e=__us; e.player.x=1; e.player.z=6; e.player.y=e.cur.ground(1,6,5); return 1})()`);
await B.eval(`(()=>{const e=__us; e.player.x=-0.5; e.player.z=6; e.player.y=e.cur.ground(-0.5,6,5); return 1})()`);

/* ---------- text chat ---------- */
await front(A);
await A.eval(`document.querySelector('.comms .cbtn').click(); 1`); await sleep(600);
check('Chat window opens', await A.eval(`!!document.querySelector('.chat')`));
await setVal(A, '.chat input', 'meet me at the sakura bridge 🌸'); await sleep(150);
await A.eval(`document.querySelector('.chat form .btn').click(); 1`); await sleep(400);
await A.eval(`[...document.querySelectorAll('.chat .quick .pill')].find(p=>p.textContent.includes('race you'))?.click(); 1`); await sleep(700);
await A.shot(`${OUT}/chat-arushi.png`);
await front(B); await sleep(600);
await A.eval(`[...document.querySelectorAll('.chat .quick .pill')].find(p=>p.textContent.includes('come here'))?.click(); 1`);   // sent while the partner is looking
let bBubble = ''; for (let i = 0; i < 10 && !bBubble.includes('come here'); i++) { await sleep(300); bBubble = await B.eval(`[...document.querySelectorAll('.bubble')].map(b=>b.textContent).join(' | ')`); }
check('Partner sees the message as a speech bubble', bBubble.includes('come here'), bBubble);
const badge = await B.eval(`document.querySelector('.comms .cnt')?.textContent || '0'`);
check('Unread badge on the partner chat button', Number(badge) >= 2, `badge ${badge}`);
await B.shot(`${OUT}/chat-bubble-shaurya.png`);
await B.eval(`document.querySelector('.comms .cbtn').click(); 1`); await sleep(700);
const bList = await B.eval(`[...document.querySelectorAll('.chat .msg')].map(m=>m.textContent).join(' | ')`);
check('Partner chat log shows both messages', bList.includes('sakura bridge') && bList.includes('race you'), bList);
await setVal(B, '.chat input', 'coming! 💗'); await B.eval(`document.querySelector('.chat form .btn').click(); 1`); await sleep(500);
await B.shot(`${OUT}/chat-shaurya.png`);
await front(A); await sleep(1000);
check('Reply arrives back', (await A.eval(`[...document.querySelectorAll('.chat .msg')].map(m=>m.textContent).join(' | ')`)).includes('coming!'));
check('Typing in chat does not move/jump the character', await A.eval(`(async()=>{ const y=__us.player.y; const el=document.querySelector('.chat input'); el.focus(); el.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true})); el.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true})); await new Promise(r=>setTimeout(r,300)); return Math.abs(__us.player.y-y) < 0.05 })()`));
await A.eval(`document.querySelector('.chat .pill')?.click(); 1`); await B.eval(`document.querySelector('.chat .pill')?.click(); 1`); await sleep(400);

/* ---------- voice: always-on ---------- */
const mode = (p) => p.eval(`document.querySelector('.comms .cbtn.mode small')?.textContent`);
const cycleTo = async (p, want) => { for (let i = 0; i < 4 && (await mode(p)) !== want; i++) { await p.eval(`document.querySelector('.comms .cbtn.mode').click(); 1`); await sleep(900); } };
await front(A); await cycleTo(A, 'open');
await front(B); await cycleTo(B, 'open');
let live = false; for (let i = 0; i < 40 && !live; i++) { await front(i % 2 ? A : B); await sleep(500); live = (await A.eval(`__voice.state.link`)) === 'live' && (await B.eval(`__voice.state.link`)) === 'live'; }
check('Voice link connects (direct phone-to-phone)', live, `${await A.eval('__voice.state.link')} / ${await B.eval('__voice.state.link')}`);
const energy = async (p, ms = 2500) => { const s0 = await p.eval('__voice.stats()'); await sleep(ms); const s1 = await p.eval('__voice.stats()'); return { e: s1.energy - s0.energy, bytes: s1.received - s0.received }; };
await front(B);
const open1 = await energy(B);
check('Always-on mic: partner receives live audio', open1.bytes > 2000 && open1.e > 0.0001, JSON.stringify(open1));
await B.shot(`${OUT}/voice-open.png`);
await front(A); await A.eval(`[...document.querySelectorAll('.comms .cbtn.talk')][0]?.click(); 1`); await sleep(600);
check('Mute button shows MUTED', (await A.eval(`document.querySelector('.comms .cbtn.talk')?.textContent`)).includes('MUTED'));
await front(B); const muted = await energy(B);
check('Muted mic sends silence', muted.e < 0.001, JSON.stringify(muted));

/* ---------- voice: push-to-talk ---------- */
await front(A); await cycleTo(A, 'push'); await sleep(1500);
let relinked = false; for (let i = 0; i < 30 && !relinked; i++) { await sleep(400); relinked = (await A.eval(`__voice.state.link`)) === 'live'; }
await front(B); const idle = await energy(B);
check('Push-to-talk: silent while not held', idle.e < 0.001, JSON.stringify(idle));
await front(A);
await A.eval(`document.querySelector('.comms .cbtn.talk').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true, pointerId: 1})); 1`); await sleep(300);
check('Holding TALK shows ON AIR', (await A.eval(`document.querySelector('.comms .cbtn.talk').textContent`)).includes('ON AIR'));
await A.shot(`${OUT}/ptt-held.png`);
await front(B); const held = await energy(B, 4000);
check('Push-to-talk: partner hears you while held', held.e > Math.max(idle.e * 100, 1e-6) && held.bytes > 2000, JSON.stringify(held) + ' vs idle ' + JSON.stringify(idle));
await front(A); await A.eval(`document.querySelector('.comms .cbtn.talk').dispatchEvent(new PointerEvent('pointerup',{bubbles:true, pointerId: 1})); 1`); await sleep(400);
await front(B); const after = await energy(B);
check('Push-to-talk: silent again after release', after.e < 0.001, JSON.stringify(after));

/* ---------- walkie-talkie fallback (no direct link) ---------- */
await front(A);
await A.eval(`(()=>{ __voice.pc.close(); __voice.state.link = 'failed'; return 1 })()`);
await A.eval(`document.querySelector('.comms .cbtn.talk').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true, pointerId: 1})); 1`); await sleep(2500);
await A.eval(`document.querySelector('.comms .cbtn.talk').dispatchEvent(new PointerEvent('pointerup',{bubbles:true, pointerId: 1})); 1`); await sleep(1800);
await front(B); await sleep(1500);
await B.eval(`document.querySelector('.comms .cbtn').click(); 1`); await sleep(700);
const clip = await B.eval(`[...document.querySelectorAll('.chat .msg')].some(m=>m.textContent.includes('voice clip'))`);
check('No direct link → push-to-talk sends a voice clip that arrives', clip);
await B.shot(`${OUT}/walkie-clip.png`);

const errs = [...A.errors, ...B.errors].filter((e) => !/favicon|WebGL|GPU stall|swiftshader/i.test(String(e)));
check('No JavaScript errors', !errs.length, errs.slice(0, 3).join(' | '));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
b.close(); process.exit(0);
