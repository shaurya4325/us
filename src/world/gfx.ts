// Shared low-cost graphics: one pastel MatCap shared by everything (no lights, no shadow maps),
// vertex-coloured merged geometry, canvas textures, blob shadows and pooled particles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const; };

let _matcap: THREE.Texture | null = null;
/** soft "sunlit pastel" MatCap: warm top-left key, lavender underside, rosy rim glow */
export function matcap() {
  if (_matcap) return _matcap;
  const [c, g] = canvas(256, 256);
  const base = g.createLinearGradient(0, 0, 0, 256);
  base.addColorStop(0, '#ffffff'); base.addColorStop(0.55, '#f1eaf0'); base.addColorStop(1, '#a99bc4');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  const key = g.createRadialGradient(92, 78, 4, 92, 78, 150);
  key.addColorStop(0, 'rgba(255,252,240,1)'); key.addColorStop(1, 'rgba(255,240,230,0)');
  g.fillStyle = key; g.fillRect(0, 0, 256, 256);
  const rim = g.createRadialGradient(128, 128, 96, 128, 128, 128);
  rim.addColorStop(0, 'rgba(255,225,240,0)'); rim.addColorStop(1, 'rgba(255,214,236,0.85)');
  g.fillStyle = rim; g.fillRect(0, 0, 256, 256);
  _matcap = new THREE.CanvasTexture(c);
  _matcap.colorSpace = THREE.SRGBColorSpace;
  return _matcap;
}

export const mat = (opts: THREE.MeshMatcapMaterialParameters = {}) => new THREE.MeshMatcapMaterial({ matcap: matcap(), vertexColors: true, ...opts });
export const basic = (color: number, opts: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color, ...opts });

/** wind sway for grass/flowers/foliage: bends vertices by height, per-instance phase */
export function windy(m: THREE.Material, uTime: { value: number }, amount = 0.12) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
      #else
        vec3 ip = vec3(0.0);
      #endif
      float sw = sin(uTime * 1.7 + ip.x * 0.6 + ip.z * 0.45) * ${amount.toFixed(3)} * max(position.y, 0.0);
      transformed.x += sw; transformed.z += sw * 0.6;`);
  };
  m.customProgramCacheKey = () => 'windy' + amount.toFixed(3);   // each sway strength is its own program
  return m;
}

/** see-through: anything between the camera and your character dissolves into a soft pixel dither,
 *  so tree canopies, pillars and roofs never hide you. The engine updates these uniforms every frame. */
export const SEE = { uP: { value: new THREE.Vector2(-9999, -9999) }, uR: { value: 0 }, uZ: { value: 0 } };
export function seeThrough<T extends THREE.Material>(m: T): T {
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.uniforms.uSeeP = SEE.uP; sh.uniforms.uSeeR = SEE.uR; sh.uniforms.uSeeZ = SEE.uZ;
    sh.fragmentShader = 'uniform vec2 uSeeP; uniform float uSeeR; uniform float uSeeZ;\n' + sh.fragmentShader.replace('void main() {', `void main() {
      { float sd = distance(gl_FragCoord.xy, uSeeP) / max(uSeeR, 1.0);
        if (sd < 1.0 && gl_FragCoord.z < uSeeZ) { float ck = mod(floor(gl_FragCoord.x * 0.5) + floor(gl_FragCoord.y * 0.5), 2.0); if (sd < 0.55 || ck > 0.5) discard; } }`);
  };
  m.customProgramCacheKey = () => (key ? key() : '') + '|see';
  return m;
}

/** give a geometry a flat vertex colour and normalise attributes so anything can be merged */
export function tint(geo: THREE.BufferGeometry, color: number | THREE.Color, jitter = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const n = g.attributes.position.count, col = new Float32Array(n * 3), c = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    const j = jitter ? 1 + (Math.random() - 0.5) * jitter : 1;
    col[i * 3] = c.r * j; col[i * 3 + 1] = c.g * j; col[i * 3 + 2] = c.b * j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** tiny builder: add tinted primitives with transforms, then merge into one geometry (one draw call) */
export class Kit {
  parts: THREE.BufferGeometry[] = [];
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler(); private s = new THREE.Vector3(); private p = new THREE.Vector3();
  add(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, jitter = 0) {
    const g = tint(geo, color, jitter);
    this.m.compose(this.p.set(x, y, z), this.q.setFromEuler(this.e.set(rx, ry, rz)), this.s.set(sx, sy, sz));
    g.applyMatrix4(this.m);
    this.parts.push(g);
    return this;
  }
  box(w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0, ry = 0) { return this.add(new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z, 0, ry); }
  cyl(rt: number, rb: number, h: number, c: number, x = 0, y = 0, z = 0, seg = 10) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y + h / 2, z); }
  ball(r: number, c: number, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, det = 1) { return this.add(new THREE.IcosahedronGeometry(r, det), c, x, y, z, 0, 0, 0, sx, sy, sz); }
  build() { const g = mergeGeometries(this.parts, false)!; this.parts.forEach((p) => p.dispose()); this.parts = []; g.computeBoundingSphere(); return g; }
}

export function skyTexture(top = '#9fd9f2', mid = '#ffe3ef', bottom = '#fff6e8') {
  const [c, g] = canvas(4, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(0.6, mid); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

let _blob: THREE.Texture | null = null;
export function blobTex() {
  if (_blob) return _blob;
  const [c, g] = canvas(64, 64);
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  r.addColorStop(0, 'rgba(40,30,60,0.42)'); r.addColorStop(1, 'rgba(40,30,60,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return (_blob = new THREE.CanvasTexture(c));
}

let _soft: THREE.Texture | null = null;
export function softDot() {
  if (_soft) return _soft;
  const [c, g] = canvas(64, 64);
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return (_soft = new THREE.CanvasTexture(c));
}
let _heart: THREE.Texture | null = null;
export function heartTex() {
  if (_heart) return _heart;
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#fff'; g.font = '52px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♥', 32, 36);
  return (_heart = new THREE.CanvasTexture(c));
}

/** blob shadows for many movers in ONE instanced draw */
export class Shadows {
  mesh: THREE.InstancedMesh; private n = 0; private m = new THREE.Matrix4();
  constructor(max: number) {
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false }), max);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
  }
  begin() { this.n = 0; }
  put(x: number, y: number, z: number, s: number) {
    if (this.n >= this.mesh.count) return;
    this.m.makeScale(s, 1, s).setPosition(x, y + 0.02, z);
    this.mesh.setMatrixAt(this.n++, this.m);
  }
  end() { for (let i = this.n; i < this.mesh.count; i++) this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0)); this.mesh.instanceMatrix.needsUpdate = true; }
}

/** pooled additive particles (sparkles, leaves, hearts): ONE draw per pool, zero allocations per frame */
export class Particles {
  points: THREE.Points; private pos: Float32Array; private col: Float32Array; private size: Float32Array;
  private vel: Float32Array; private life: Float32Array; private max: number; private next = 0; private c = new THREE.Color();
  constructor(max: number, tex: THREE.Texture, additive = true) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, scale: { value: 300 } }, transparent: true, depthWrite: false, vertexColors: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float size; varying vec3 vC; uniform float scale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, 1.0) * t; if (gl_FragColor.a < 0.02) discard; }`,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 5;
  }
  burst(x: number, y: number, z: number, n: number, color: number, spread = 1.6, up = 2.2, size = 0.35, life = 0.9, gravity = true) {
    this.c.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.next; this.next = (this.next + 1) % this.max;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      this.vel[i * 3] = Math.cos(a) * r; this.vel[i * 3 + 1] = up * (0.5 + Math.random()); this.vel[i * 3 + 2] = Math.sin(a) * r;
      if (!gravity) this.vel[i * 3 + 1] = up * (0.3 + Math.random() * 0.5);
      const j = 0.85 + Math.random() * 0.3;
      this.col[i * 3] = this.c.r * j; this.col[i * 3 + 1] = this.c.g * j; this.col[i * 3 + 2] = this.c.b * j;
      this.size[i] = size * (0.6 + Math.random() * 0.8); this.life[i] = life * (0.7 + Math.random() * 0.6) * (gravity ? 1 : -1);
    }
  }
  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      let l = this.life[i]; if (l === 0) continue;
      const grav = l > 0; l = Math.abs(l) - dt;
      if (l <= 0) { this.life[i] = 0; this.size[i] = 0; continue; }
      this.life[i] = grav ? l : -l;
      if (grav) this.vel[i * 3 + 1] -= 6 * dt; else { this.vel[i * 3] *= 0.97; this.vel[i * 3 + 2] *= 0.97; }
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (l < 0.25) this.size[i] *= 0.9;
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = true; a.color.needsUpdate = true; a.size.needsUpdate = true;
  }
}

/** rounded-rect label texture for name plates, signs and room labels */
export function labelSprite(text: string, color = '#FF3E8A', scale = 1, heart = true) {
  const [c, g] = canvas(512, 128);
  g.font = '700 50px "Pixelify Sans", monospace';
  const label = heart ? `♥ ${text}` : text;
  const w = Math.min(500, g.measureText(label).width + 48), x0 = Math.round((512 - w) / 2);
  g.fillStyle = '#1a1018'; g.fillRect(x0 - 6, 22, w + 12, 84);                 // black pixel edge
  g.fillStyle = 'rgba(52,40,58,0.92)'; g.fillRect(x0, 28, w, 72);
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x0, 28, w, 6); g.fillRect(x0, 28, 6, 72);   // bevel
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x0, 94, w, 6); g.fillRect(x0 + w - 6, 28, 6, 72);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#1a1018'; g.fillText(label, 260, 68);
  g.fillStyle = '#FFF6EC'; g.fillText(label, 256, 64);
  if (heart) { g.fillStyle = color; g.fillText('♥', 256 - g.measureText(label).width / 2 + 14, 64); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2 * scale, 0.5 * scale, 1); s.renderOrder = 10;
  return s;
}

/** the world's water: turquoise with drifting caustic shimmer, one cheap shader. strip = a ribbon (streams). */
export function waterMaterial(uTime: { value: number }, deep = '#2fb8c9', light = '#9ef0ea', strip = false, alpha = 0.9) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime, cDeep: { value: new THREE.Color(deep) }, cLight: { value: new THREE.Color(light) }, uA: { value: alpha } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vP; varying vec2 vU; void main(){ vU = uv; vec4 w = modelMatrix * vec4(position,1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime; uniform vec3 cDeep; uniform vec3 cLight; uniform float uA; varying vec2 vP; varying vec2 vU;
      void main(){
        float d = ${strip ? 'abs(vU.y - 0.5) * 2.0' : 'length(vU - 0.5) * 2.0'};
        float s = sin(vP.x * 2.3 + uTime * 1.3) * sin(vP.y * 2.1 - uTime * 1.1) + sin((vP.x + vP.y) * 3.7 + uTime * 2.0) * 0.5;
        float s2 = sin(vP.x * 0.9 - uTime * 0.6) * sin(vP.y * 0.8 + uTime * 0.5);
        vec3 c = mix(cLight, cDeep, smoothstep(0.0, 0.9, d) * 0.6 + 0.25 + s2 * 0.08);
        c += smoothstep(0.9, 1.4, s) * 0.32;
        c = mix(c, vec3(1.0), smoothstep(0.84, 1.0, d) * 0.6);
        gl_FragColor = vec4(c, uA * (1.0 - smoothstep(0.97, 1.0, d) * 0.6));
      }`,
  });
}

let _petal: THREE.Texture | null = null;
export function petalTex() {
  if (_petal) return _petal;
  const [c, g] = canvas(64, 64);
  const r = g.createRadialGradient(28, 26, 2, 32, 32, 30);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.7, 'rgba(255,255,255,0.85)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.beginPath(); g.ellipse(32, 32, 26, 15, 0.5, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(56, 20, 7, 0, Math.PI * 2); g.fill();
  return (_petal = new THREE.CanvasTexture(c));
}

/** GPU-animated drifting particles (sakura petals, fireflies, star motes, sea sparkles): zero CPU per frame.
 *  mode 0 = falling with wind, 1 = floating, 2 = floating + twinkle */
export function driftField(n: number, uTime: { value: number }, o: { x: number; z: number; r: number; y0: number; y1: number; colors: number[]; size: number; speed?: number; wind?: number; mode: 0 | 1 | 2; tex?: THREE.Texture; additive?: boolean; spin?: boolean; opacity?: number }) {
  const seed = new Float32Array(n * 4), col = new Float32Array(n * 3), pos = new Float32Array(n * 3), c = new THREE.Color(), r = rand(Math.abs(n * 7 + Math.round(o.x * 3 + o.z)) + 11);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) seed[i * 4 + k] = r();
    c.set(o.colors[i % o.colors.length]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    pos[i * 3] = o.x; pos[i * 3 + 1] = o.y0; pos[i * 3 + 2] = o.z;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 4)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime, map: { value: o.tex ?? softDot() }, uC: { value: new THREE.Vector3(o.x, 0, o.z) }, uR: { value: o.r }, uY0: { value: o.y0 }, uY1: { value: o.y1 },
      uSpeed: { value: o.speed ?? 1 }, uWind: { value: o.wind ?? 0 }, uSize: { value: o.size }, uMode: { value: o.mode }, uSpin: { value: o.spin ? 1 : 0 }, uA: { value: o.opacity ?? 1 } },
    transparent: true, depthWrite: false, vertexColors: true, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `uniform float uTime, uR, uY0, uY1, uSpeed, uWind, uSize, uMode, uSpin; uniform vec3 uC; attribute vec4 seed; varying vec3 vC; varying float vA; varying float vRot;
      void main(){
        float t = uTime * uSpeed, H = uY1 - uY0, a = seed.x * 6.2831, rr = sqrt(seed.y) * uR;
        vec3 p = vec3(uC.x + cos(a) * rr, 0.0, uC.z + sin(a) * rr);
        vA = 1.0;
        if (uMode < 0.5) {
          float y = mod(seed.z * H - t * (0.55 + seed.w * 0.5), H), fall = H - y;
          p.y = uY0 + y;
          p.x += sin(t * 1.3 + seed.w * 20.0) * 0.6 + fall * uWind; p.z += cos(t * 1.1 + seed.z * 20.0) * 0.6 + fall * uWind * 0.45;
          vA = smoothstep(0.0, 0.7, y) * smoothstep(H, H - 1.0, y);
        } else {
          p.y = uY0 + seed.z * H + sin(t * 0.8 + seed.w * 30.0) * 0.45;
          p.x += sin(t * 0.37 + seed.w * 11.0) * 1.3; p.z += cos(t * 0.29 + seed.z * 13.0) * 1.3;
          if (uMode > 1.5) vA = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * 2.2 + seed.w * 40.0), 3.0);
        }
        vC = color; vRot = uSpin * (t * (1.0 + seed.y * 2.0) + seed.x * 6.28);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (0.6 + seed.y * 0.7) * 300.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D map; uniform float uA; varying vec3 vC; varying float vA; varying float vRot;
      void main(){
        vec2 q = gl_PointCoord - 0.5; float cs = cos(vRot), sn = sin(vRot); q = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y) + 0.5;
        vec4 t = texture2D(map, q); gl_FragColor = vec4(vC, vA * uA) * t; if (gl_FragColor.a < 0.02) discard;
      }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4;
  return pts;
}

export function disposeTree(o: THREE.Object3D) {
  o.traverse((x: any) => {
    x.geometry?.dispose?.();
    const ms = Array.isArray(x.material) ? x.material : x.material ? [x.material] : [];
    ms.forEach((m: any) => { for (const k in m) if (m[k]?.isTexture && ![_matcap, _blob, _soft, _heart, _petal].includes(m[k])) m[k].dispose(); if (m.uniforms) for (const u in m.uniforms) { const v = m.uniforms[u]?.value; if (v?.isTexture && ![_matcap, _blob, _soft, _heart, _petal].includes(v)) v.dispose(); } m.dispose(); });
  });
}

export const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
