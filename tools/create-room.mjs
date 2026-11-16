// Registers the room for a passcode in Firestore so the app accepts that passcode.
// The app only lets people in whose passcode leads to an existing room; the passcode itself is never stored anywhere.
//   node tools/create-room.mjs <8-digit passcode>
// Run it once for your passcode (and again if you ever change it). It never overwrites seats or data.
import crypto from 'node:crypto';
import fs from 'node:fs';

const code = (process.argv[2] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
if (code.length < 6) { console.error('usage: node tools/create-room.mjs <passcode>'); process.exit(1); }
const env = Object.fromEntries(fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split('=')));
const room = crypto.createHash('sha256').update('us!!:' + code).digest('hex').slice(0, 32);   // same as roomIdFor() in src/lib/sync.ts
const base = `https://firestore.googleapis.com/v1/projects/${env.VITE_FB_PROJECT_ID}/databases/(default)/documents/us/${room}`;
const now = String(Date.now());
const existing = await fetch(`${base}?key=${env.VITE_FB_API_KEY}`);
if (existing.ok) { console.log('Room already exists — this passcode already works. Nothing changed.'); process.exit(0); }
const r = await fetch(`${base}?key=${env.VITE_FB_API_KEY}&updateMask.fieldPaths=createdAt&updateMask.fieldPaths=maxMembers`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: { createdAt: { integerValue: now }, maxMembers: { integerValue: '2' } } }),
});
console.log(r.ok ? 'Room created — the app now accepts this passcode.' : `Failed: HTTP ${r.status} ${await r.text()}`);
