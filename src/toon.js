// アニメ風の見た目：段のある陰影・濃い色・黒いふち線・大きな目
// 写実の材質をあとから置きかえる（設定「見た目」で写実に戻せる）
import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

// 3段の明暗（影・中間・明るい）
function gradient() {
  const d = new Uint8Array([90, 175, 255]);
  const t = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
const GRAD = gradient();

// 色を少し濃く・明るく
function pop(c, s = 1.3, l = 1.06) {
  const hsl = {}; c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * s), Math.min(0.92, hsl.l * l));
}

export function toonMaterial(m) {
  if (!m || m.isMeshToonMaterial || m.isShaderMaterial || m.isMeshBasicMaterial || m.isLineBasicMaterial || m.isPointsMaterial) return m;
  const t = new THREE.MeshToonMaterial({
    name: m.name, color: m.color ? pop(m.color) : 0xffffff, map: m.map || null, gradientMap: GRAD,
    normalMap: m.normalMap || null, alphaMap: m.alphaMap || null, alphaTest: m.alphaTest || 0,
    transparent: m.transparent, opacity: m.opacity, side: m.side, depthWrite: m.depthWrite, depthTest: m.depthTest,
    emissive: m.emissive ? m.emissive.clone() : 0x000000, emissiveMap: m.emissiveMap || null, emissiveIntensity: m.emissiveIntensity ?? 1,
    vertexColors: m.vertexColors, visible: m.visible, polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits,
  });
  if (m.normalScale && t.normalScale) t.normalScale.copy(m.normalScale).multiplyScalar(0.35);   // 凹凸は弱く
  // 部屋の写真の質感：土壁・布・石は単色に、木と畳は模様だけ残して凹凸を消す
  const pb = m.userData.pbr;
  if (pb) {
    t.normalMap = null;
    if (/plaster|linen|slate/.test(pb)) { t.map = null; t.color = pop(m.color, 1.15, /plaster/.test(pb) ? 1.08 : 1.0); }
  }
  t.userData = { ...m.userData, from: m };
  // 半透明（髪のふち・しみ）や光る面には、ふち線を付けない
  if (m.transparent || (m.emissiveIntensity > 0.5 && m.emissive && m.emissive.getHex())) t.userData.outlineParameters = { visible: false };
  return t;
}

// 置きかえ：同じ材質は同じ置きかえ先にする（共有を保つ）
export function toonify(root, cache = new Map()) {
  const conv = m => { if (!cache.has(m)) cache.set(m, toonMaterial(m)); return cache.get(m); };
  root.traverse(o => {
    if (!o.isMesh || o.userData.noToon) return;
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
  return cache;
}

// アニメ風の頭：写実の頭と髪を隠し、大きな頭（大きな目・眉・口・髪）を頭の骨に付ける。
// 体・手・骨の動きは写実のまま。目線・まばたき・口・表情は、元の顔の動きと同じ値で動かす。
export const LOOKS = {
  player: { skin: '#f6cba8', hair: '#221a15', style: 'short', brow: '#221a15' },
  partner: { skin: '#f9d6bd', hair: '#4a2a1a', style: 'pony', brow: '#3a2216', band: '#e8b84a', lash: true },
  father: { skin: '#eebd98', hair: '#a8a29a', style: 'side', brow: '#7d776f', glasses: true },
  mother: { skin: '#f6d0b4', hair: '#5a3422', style: 'bob', brow: '#4a2a1a', lash: true },
};
const HIDE = new THREE.MeshBasicMaterial({ visible: false });
const toonM = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: GRAD, ...o });
const basicM = (c) => { const m = new THREE.MeshBasicMaterial({ color: c }); m.userData.outlineParameters = { visible: false }; return m; };
const sph = (r, ws = 32, hs = 20, ...a) => new THREE.SphereGeometry(r, ws, hs, ...a);

export class CartoonHead {
  constructor(actor, look) {
    const B = actor.bones; this.look = look;
    actor.root.updateMatrixWorld(true);
    // 写実の頭・髪を隠す
    actor.model.traverse(o => {
      if (!o.isMesh) return;
      const h = m => (m && /head|opacity|hairEdge/.test(m.name)) ? HIDE : m;
      o.material = Array.isArray(o.material) ? o.material.map(h) : h(o.material);
    });
    const R = this.R = 0.122;
    const hw = new THREE.Vector3(); B.Head.getWorldPosition(hw);
    const G = this.G = new THREE.Group();
    G.position.copy(hw).add(new THREE.Vector3(0, 0.1, 0.012));
    actor.root.add(G); actor.root.updateMatrixWorld(true);
    const skin = toonM(look.skin), hair = toonM(look.hair), dark = basicM('#2a1712');
    const add = (geo, mat, x = 0, y = 0, z = 0, sc) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sc) m.scale.set(...sc); m.castShadow = true; m.userData.noToon = true; m.frustumCulled = false; G.add(m); return m; };
    // 頭・耳・鼻・首
    add(sph(R, 40, 28), skin, 0, 0, 0, [1, 1.06, 0.97]);
    if (look.style !== 'bob') for (const x of [-1, 1]) add(sph(0.027, 16, 12), skin, x * R * 0.98, -0.012, -0.004, [0.6, 1, 0.9]);
    add(sph(0.017, 16, 12), skin, 0, -0.022, R * 0.97, [1, 0.9, 1]);
    add(new THREE.CylinderGeometry(0.046, 0.05, 0.13, 20), skin, 0, -R - 0.02, -0.012);
    // 目（白目・黒目・光）
    this.eyes = [];
    const white = toonM('#ffffff'); white.userData.outlineParameters = { thickness: 0.006, color: [0.08, 0.05, 0.04], alpha: 1 };
    const pupilM = basicM('#17110d'), shineM = basicM('#ffffff');
    for (const x of [-1, 1]) {
      const eg = new THREE.Group(); eg.position.set(x * 0.046, 0.016, R * 0.86); G.add(eg);
      const rE = 0.034;
      const w = new THREE.Mesh(sph(rE, 28, 20), white); w.userData.noToon = true; eg.add(w);
      const p = new THREE.Mesh(sph(0.0135, 20, 14), pupilM); p.scale.z = 0.4; p.userData.noToon = true; eg.add(p);
      const hl = new THREE.Mesh(sph(0.0042, 10, 8), shineM); hl.userData.noToon = true; eg.add(hl);
      if (look.lash) { const l = new THREE.Mesh(new THREE.TorusGeometry(rE * 1.02, 0.0028, 6, 20, Math.PI * 0.75), dark); l.rotation.z = Math.PI * 0.125; l.position.z = 0.004; eg.add(l); }
      this.eyes.push({ g: eg, p, hl, rE, x });
    }
    // 眉
    this.brows = [];
    for (const x of [-1, 1]) {
      const b = add(new THREE.CapsuleGeometry(0.0062, 0.026, 4, 10), basicM(look.brow), x * 0.047, 0.066, R * 0.93);
      b.rotation.z = Math.PI / 2; this.brows.push({ m: b, x });
    }
    // 口（暗い楕円＋舌）
    this.mouth = add(sph(0.025, 24, 14), basicM('#5a1e1a'), 0, -0.058, R * 0.88, [1, 0.2, 0.45]);
    // 髪
    const st = look.style;
    if (st === 'short' || st === 'pony') {
      add(sph(R * 1.07, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0.008, -0.008, [1, 1.08, 1]).rotation.x = -0.32;
      add(sph(R * 0.9, 28, 16), hair, 0, 0.088, 0.03, [1.05, 0.3, 0.8]);   // 前髪
      for (const x of [-1, 1]) add(sph(0.04, 16, 12), hair, x * R * 0.9, 0.035, -0.01, [0.45, 1, 1]);   // もみあげ
    }
    if (st === 'pony') {
      add(sph(0.06, 20, 14), hair, 0, 0.015, -R * 1.12, [0.8, 1.25, 0.8]).rotation.x = 0.5;
      add(new THREE.TorusGeometry(0.03, 0.009, 8, 16), toonM(look.band), 0, 0.05, -R * 0.98).rotation.x = 1.0;
    }
    if (st === 'bob') {
      add(sph(R * 1.12, 40, 28, Math.PI * 0.5 + 0.9, Math.PI * 2 - 1.8, 0, Math.PI * 0.72), hair, 0, 0.01, -0.006, [1, 1.08, 1]);
      add(sph(R * 1.09, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.42), hair, 0, 0.012, 0.0, [1, 1.08, 1]).rotation.x = -0.2;
      add(sph(R * 0.95, 28, 16), hair, -0.02, 0.09, 0.03, [1.0, 0.3, 0.8]).rotation.z = 0.25;
    }
    if (st === 'side') {
      add(sph(R * 1.05, 36, 20, Math.PI * 0.5 + 1.25, Math.PI * 2 - 2.5, Math.PI * 0.3, Math.PI * 0.15), hair, 0, 0.01, 0, [1, 1.06, 1]);
      add(sph(R * 1.02, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.16), hair, 0, 0.004, -0.03, [1, 1.06, 1]);
    }
    if (look.glasses) {
      const fr = basicM('#3b2a1e');
      for (const x of [-1, 1]) { const r = add(new THREE.TorusGeometry(0.036, 0.0035, 8, 28), fr, x * 0.046, 0.016, R * 0.86 + 0.034); }
      add(new THREE.CylinderGeometry(0.0028, 0.0028, 0.022, 6), fr, 0, 0.022, R * 0.86 + 0.036).rotation.z = Math.PI / 2;
    }
    B.Head.attach(G);
    this.tmp = new THREE.Vector3();
  }
  update(actor, blink, F, lookDown) {
    const G = this.G;
    // 目線：見ている先（なければ少し下の前）を、頭の中の向きに直す
    let tgtL = null;
    if (actor._eyeTgt) tgtL = G.worldToLocal(this.tmp.copy(actor._eyeTgt));
    const sac = actor.gaze ? actor.gaze.sac : { x: 0, y: 0 };
    const squash = Math.max(0.08, 1 - Math.max(blink, lookDown * 0.6));
    for (const e of this.eyes) {
      const d = tgtL ? tgtL.clone().sub(e.g.position).normalize() : new THREE.Vector3(0, -0.08, 1).normalize();
      d.x += sac.x * 2; d.y += sac.y * 2;
      d.z = Math.max(d.z, 0.72); d.normalize();
      e.p.position.copy(d).multiplyScalar(e.rE * 0.9);
      e.p.lookAt(G.localToWorld(e.g.position.clone().add(d.clone().multiplyScalar(1))));
      e.hl.position.copy(e.p.position).add(new THREE.Vector3(0.005, 0.0055, 0.006));
      e.g.scale.y = squash;
    }
    const worry = F.worry, smile = F.smile;
    for (const b of this.brows) { b.m.rotation.z = Math.PI / 2 - b.x * worry * 0.5 + b.x * smile * 0.1; b.m.position.y = 0.066 + worry * 0.008 + smile * 0.004; }
    const jaw = F.jaw;
    this.mouth.scale.set(1 + smile * 0.7 - jaw * 0.15 - worry * 0.35, 0.16 + jaw * 1.4 + worry * 0.55 + smile * 0.3, 0.45);
  }
}

// ふち線つきで描く
export function outlineRenderer(renderer) {
  return new OutlineEffect(renderer, { defaultThickness: 0.0035, defaultColor: [0.07, 0.05, 0.04], defaultAlpha: 1, defaultKeepAlive: true });
}
